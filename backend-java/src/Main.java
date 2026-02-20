import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.Executors;

public class Main {
    static final Set<String> LANGUAGES = Set.of("en", "fr", "de", "it", "es");
    static final Set<String> LEVELS = Set.of("A1", "A2", "B1", "B2", "C1");
    static final String DEFAULT_GROUP = "Default";
    static final String OPENAI_API_KEY = System.getenv("OPENAI_API_KEY");
    static final String OPENAI_MODEL = System.getenv().getOrDefault("OPENAI_MODEL", "gpt-4o-mini");
    static final HttpClient HTTP = HttpClient.newHttpClient();

    static class User { String id, email, password, createdAt; }
    static class Profile { String userId, knownLanguage, targetLanguage, level; }
    static class Card { String id, userId, targetLanguage, text, status, createdAt, groupName; }
    static class Content { String cardId, knownLanguage, level, meaningTarget, meaningKnown, sentenceTarget, sentenceKnown, createdAt; }
    static class Review { String userId, cardId, result, reviewedAt; }
    static class Srs { String userId, cardId, dueAt; int intervalDays; String updatedAt; }

    static final List<User> users = new ArrayList<>();
    static final List<Profile> profiles = new ArrayList<>();
    static final List<Card> cards = new ArrayList<>();
    static final List<Content> contents = new ArrayList<>();
    static final List<Review> reviews = new ArrayList<>();
    static final List<Srs> srsStates = new ArrayList<>();
    static final Map<String, String> tokens = new HashMap<>();

    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(3001), 0);
        server.createContext("/api", Main::handle);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("Java API listening on http://localhost:3001");
    }

    static void handle(HttpExchange ex) throws IOException {
        cors(ex);
        if ("OPTIONS".equals(ex.getRequestMethod())) { send(ex, 204, ""); return; }

        String method = ex.getRequestMethod();
        String path = ex.getRequestURI().getPath();
        try {
            if (path.equals("/api/auth/signup") && method.equals("POST")) { signup(ex); return; }
            if (path.equals("/api/auth/login") && method.equals("POST")) { login(ex); return; }
            if (path.equals("/api/auth/forgot-password") && method.equals("POST")) { send(ex,200,"{\"ok\":true}"); return; }

            String userId = auth(ex);
            if (userId == null) { send(ex, 401, "{\"error\":\"UNAUTHORIZED\"}"); return; }

            if (path.equals("/api/profile") && method.equals("GET")) { getProfile(ex, userId); return; }
            if (path.equals("/api/profile") && method.equals("PATCH")) { patchProfile(ex, userId); return; }

            if (path.equals("/api/groups") && method.equals("GET")) { groups(ex, userId); return; }
            if (path.matches("/api/groups/[^/]+/cards") && method.equals("DELETE")) { deleteGroupCards(ex, userId, urlDecode(path.split("/")[3])); return; }
            if (path.matches("/api/groups/[^/]+") && method.equals("DELETE")) { deleteGroup(ex, userId, urlDecode(path.split("/")[3])); return; }
            if (path.equals("/api/cards") && method.equals("POST")) { createCard(ex, userId); return; }
            if (path.equals("/api/cards") && method.equals("GET")) { listCards(ex, userId); return; }
            if (path.equals("/api/session/next") && method.equals("GET")) { sessionNext(ex, userId); return; }
            if (path.equals("/api/review/summary") && method.equals("GET")) { reviewSummary(ex, userId); return; }
            if (path.equals("/api/stats") && method.equals("GET")) { stats(ex, userId); return; }

            if (path.matches("/api/cards/[^/]+") && method.equals("DELETE")) { deleteCard(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/retry") && method.equals("POST")) { retryCard(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/known") && method.equals("POST")) { known(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/unknown") && method.equals("POST")) { unknown(ex, userId, path.split("/")[3]); return; }

            send(ex, 404, "{\"error\":\"NOT_FOUND\"}");
        } catch (Exception e) {
            send(ex, 500, "{\"error\":\"INTERNAL\"}");
        }
    }

    static void signup(HttpExchange ex) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String email=b.get("email"), pass=b.get("password");
        if (email==null || pass==null || pass.length()<6 || !email.contains("@")) { send(ex,400,"{\"error\":\"INVALID_INPUT\"}"); return; }
        for (User u: users) if (u.email.equals(email)) { send(ex,409,"{\"error\":\"EMAIL_EXISTS\"}"); return; }
        User u = new User(); u.id=uuid(); u.email=email; u.password=pass; u.createdAt=now(); users.add(u);
        String token=uuid(); tokens.put(token,u.id);
        send(ex,200,"{\"token\":\""+token+"\"}");
    }

    static void login(HttpExchange ex) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String email=b.get("email"), pass=b.get("password");
        if (email==null || pass==null) { send(ex,400,"{\"error\":\"INVALID_INPUT\"}"); return; }
        for (User u: users) if (u.email.equals(email) && u.password.equals(pass)) {
            String token=uuid(); tokens.put(token,u.id);
            send(ex,200,"{\"token\":\""+token+"\"}"); return;
        }
        send(ex,401,"{\"error\":\"INVALID_CREDENTIALS\"}");
    }

    static void getProfile(HttpExchange ex, String userId) throws IOException {
        Profile p = profile(userId);
        if (p==null) { send(ex,404,"{\"error\":\"PROFILE_NOT_FOUND\"}"); return; }
        send(ex,200,String.format("{\"knownLanguage\":\"%s\",\"targetLanguage\":\"%s\",\"level\":\"%s\"}", p.knownLanguage,p.targetLanguage,p.level));
    }

    static void patchProfile(HttpExchange ex, String userId) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String known=b.get("knownLanguage"), target=b.get("targetLanguage"), level=b.get("level");
        if (!LANGUAGES.contains(known) || !LANGUAGES.contains(target) || !LEVELS.contains(level)) { send(ex,400,"{\"error\":\"INVALID_INPUT\"}"); return; }
        if (known.equals(target)) { send(ex,400,"{\"error\":\"LANGUAGE_PAIR_INVALID\",\"message\":\"Target language must differ from known language.\"}"); return; }
        Profile p=profile(userId); if (p==null){ p=new Profile(); p.userId=userId; profiles.add(p); }
        p.knownLanguage=known; p.targetLanguage=target; p.level=level;
        send(ex,200,String.format("{\"knownLanguage\":\"%s\",\"targetLanguage\":\"%s\",\"level\":\"%s\"}", known,target,level));
    }

    static void groups(HttpExchange ex, String userId) throws IOException {
        LinkedHashSet<String> groupSet = new LinkedHashSet<>();
        groupSet.add(DEFAULT_GROUP);
        for (Card c : cards) if (c.userId.equals(userId) && c.groupName != null && !c.groupName.isBlank()) groupSet.add(c.groupName);

        StringBuilder arr = new StringBuilder();
        for (String g : groupSet) {
            if (arr.length() > 0) arr.append(',');
            arr.append("\"").append(esc(g)).append("\"");
        }
        send(ex, 200, "{\"groups\":[" + arr + "]}");
    }

    static void createCard(HttpExchange ex, String userId) throws IOException {
        String body = readBody(ex);
        Map<String,String> b = parseJson(body);
        String text = b.getOrDefault("text","").trim();
        if (text.isEmpty() || text.length()>80){ send(ex,400,"{\"error\":\"INVALID_TEXT\"}"); return; }

        Profile p=profile(userId); if (p==null){ send(ex,400,"{\"error\":\"PROFILE_REQUIRED\"}"); return; }
        if (dailyCount(userId)>=10){ send(ex,429,"{\"error\":\"DAILY_LIMIT_REACHED\",\"message\":\"Daily word generation limit reached.\"}"); return; }

        String groupMode = b.getOrDefault("groupMode", "default");
        String groupName = resolveGroup(userId, groupMode, b.get("groupName"));
        if (groupName == null) {
            send(ex, 400, "{\"error\":\"GROUP_INVALID\",\"message\":\"Group selection is invalid.\"}");
            return;
        }

        Card c=new Card();
        c.id=uuid(); c.userId=userId; c.targetLanguage=p.targetLanguage; c.text=text; c.status="generating"; c.createdAt=now(); c.groupName=groupName;
        cards.add(c);

        Srs s=new Srs(); s.userId=userId; s.cardId=c.id; s.intervalDays=1; s.dueAt=now(); s.updatedAt=now(); srsStates.add(s);
        generate(c,p);
        send(ex,200,"{\"cardId\":\""+c.id+"\",\"status\":\""+c.status+"\",\"groupName\":\""+esc(groupName)+"\"}");
    }

    static String resolveGroup(String userId, String groupMode, String incomingName) {
        if (groupMode == null || groupMode.equals("default")) return DEFAULT_GROUP;
        if (groupMode.equals("new")) {
            if (incomingName == null) return null;
            String n = incomingName.trim();
            if (n.isEmpty() || n.length() > 50) return null;
            return n;
        }
        if (groupMode.equals("existing")) {
            if (incomingName == null) return null;
            String n = incomingName.trim();
            if (n.isEmpty()) return null;
            for (Card c : cards) if (c.userId.equals(userId) && c.groupName.equalsIgnoreCase(n)) return c.groupName;
            if (DEFAULT_GROUP.equalsIgnoreCase(n)) return DEFAULT_GROUP;
            return null;
        }
        return null;
    }

    static void listCards(HttpExchange ex, String userId) throws IOException {
        Map<String,String> q=query(ex.getRequestURI());
        String query=q.getOrDefault("query","").toLowerCase();
        String status=q.getOrDefault("status","");
        String group=q.getOrDefault("group", "");
        int page=toInt(q.get("page"),1), pageSize=toInt(q.get("pageSize"),20);

        List<Card> filtered=new ArrayList<>();
        for(Card c:cards){
            if(!c.userId.equals(userId)) continue;
            if(!c.text.toLowerCase().contains(query)) continue;
            if(!status.isEmpty() && !c.status.equals(status)) continue;
            if(!group.isEmpty() && !"All".equalsIgnoreCase(group) && !c.groupName.equalsIgnoreCase(group)) continue;
            filtered.add(c);
        }

        int total=filtered.size();
        int start=Math.max(0,(page-1)*pageSize), end=Math.min(total,start+pageSize);
        StringBuilder items=new StringBuilder();
        for(int i=start;i<end;i++){
            Card c=filtered.get(i);
            if(items.length()>0) items.append(',');
            items.append(String.format("{\"cardId\":\"%s\",\"text\":\"%s\",\"status\":\"%s\",\"groupName\":\"%s\",\"createdAt\":\"%s\"}", c.id,esc(c.text),c.status,esc(c.groupName),c.createdAt));
        }
        send(ex,200,String.format("{\"items\":[%s],\"page\":%d,\"pageSize\":%d,\"total\":%d}",items,page,pageSize,total));
    }

    static void deleteCard(HttpExchange ex, String userId, String id) throws IOException {
        removeCardData(userId, id);
        send(ex,200,"{\"ok\":true}");
    }

    static void deleteGroupCards(HttpExchange ex, String userId, String groupName) throws IOException {
        if (groupName == null || groupName.isBlank() || "All".equalsIgnoreCase(groupName)) {
            send(ex, 400, "{\"error\":\"GROUP_INVALID\"}");
            return;
        }

        List<String> cardIds = new ArrayList<>();
        for (Card c : cards) {
            if (!c.userId.equals(userId)) continue;
            if (!c.groupName.equalsIgnoreCase(groupName)) continue;
            cardIds.add(c.id);
        }

        for (String id : cardIds) removeCardData(userId, id);
        send(ex,200,String.format("{\"ok\":true,\"deleted\":%d}", cardIds.size()));
    }

    static void deleteGroup(HttpExchange ex, String userId, String groupName) throws IOException {
        if (groupName == null || groupName.isBlank() || "All".equalsIgnoreCase(groupName) || DEFAULT_GROUP.equalsIgnoreCase(groupName)) {
            send(ex, 400, "{\"error\":\"GROUP_INVALID\"}");
            return;
        }

        int moved = 0;
        for (Card c : cards) {
            if (!c.userId.equals(userId)) continue;
            if (!c.groupName.equalsIgnoreCase(groupName)) continue;
            c.groupName = DEFAULT_GROUP;
            moved++;
        }

        send(ex,200,String.format("{\"ok\":true,\"movedToDefault\":%d}", moved));
    }

    static void removeCardData(String userId, String cardId) {
        cards.removeIf(c -> c.id.equals(cardId) && c.userId.equals(userId));
        contents.removeIf(c -> c.cardId.equals(cardId));
        srsStates.removeIf(s -> s.cardId.equals(cardId) && s.userId.equals(userId));
        reviews.removeIf(r -> r.cardId.equals(cardId) && r.userId.equals(userId));
    }

    static void retryCard(HttpExchange ex, String userId, String id) throws IOException {
        Card c=card(userId,id); if(c==null){ send(ex,404,"{\"error\":\"NOT_FOUND\"}"); return; }
        Profile p=profile(userId); if(p==null){ send(ex,400,"{\"error\":\"PROFILE_REQUIRED\"}"); return; }
        c.status="generating"; generate(c,p);
        send(ex,200,"{\"status\":\""+c.status+"\"}");
    }

    static void sessionNext(HttpExchange ex, String userId) throws IOException {
        Profile p=profile(userId); if(p==null){ send(ex,400,"{\"error\":\"PROFILE_REQUIRED\"}"); return; }
        String selectedGroup = query(ex.getRequestURI()).getOrDefault("group", "All");

        Instant now=Instant.now();
        Card found=null; Instant oldest=null;
        for(Srs s:srsStates){
            if(!s.userId.equals(userId)) continue;
            Instant due=Instant.parse(s.dueAt);
            if(due.isAfter(now)) continue;
            Card c=card(userId,s.cardId);
            if(c==null || !"ready".equals(c.status) || !c.targetLanguage.equals(p.targetLanguage)) continue;
            if (!"All".equalsIgnoreCase(selectedGroup) && !c.groupName.equalsIgnoreCase(selectedGroup)) continue;
            if(oldest==null || due.isBefore(oldest)){ oldest=due; found=c; }
        }
        if(found==null){ send(ex,200,"{\"cardId\":null,\"text\":null}"); return; }
        send(ex,200,String.format("{\"cardId\":\"%s\",\"text\":\"%s\"}",found.id,esc(found.text)));
    }

    static void known(HttpExchange ex, String userId, String id) throws IOException {
        Card c=card(userId,id); if(c==null){ send(ex,404,"{\"error\":\"NOT_FOUND\"}"); return; }
        review(userId,id,"known");
        send(ex,200,"{\"ok\":true}");
    }

    static void unknown(HttpExchange ex, String userId, String id) throws IOException {
        Card c=card(userId,id); if(c==null){ send(ex,404,"{\"error\":\"NOT_FOUND\"}"); return; }
        review(userId,id,"unknown");
        Profile p=profile(userId);
        Content cc=null; for(Content x:contents) if(x.cardId.equals(id)&&x.knownLanguage.equals(p.knownLanguage)&&x.level.equals(p.level)) { cc=x; break; }
        if(cc==null){ send(ex,409,"{\"error\":\"CONTENT_NOT_READY\"}"); return; }
        send(ex,200,String.format("{\"meaningTarget\":\"%s\",\"meaningKnown\":\"%s\",\"sentenceTarget\":\"%s\",\"sentenceKnown\":\"%s\"}",esc(cc.meaningTarget),esc(cc.meaningKnown),esc(cc.sentenceTarget),esc(cc.sentenceKnown)));
    }


    static void reviewSummary(HttpExchange ex, String userId) throws IOException {
        String selectedGroup = query(ex.getRequestURI()).getOrDefault("group", "All");
        String day = LocalDate.now(ZoneOffset.UTC).toString();
        Instant now = Instant.now();

        LinkedHashSet<String> groups = new LinkedHashSet<>();
        groups.add("All");
        groups.add(DEFAULT_GROUP);
        for (Card c : cards) {
            if (c.userId.equals(userId) && c.groupName != null && !c.groupName.isBlank()) groups.add(c.groupName);
        }

        if (!"All".equalsIgnoreCase(selectedGroup) && !groups.stream().anyMatch(g -> g.equalsIgnoreCase(selectedGroup))) {
            send(ex, 400, "{\"error\":\"GROUP_INVALID\"}");
            return;
        }

        StringBuilder groupsJson = new StringBuilder();
        for (String groupName : groups) {
            int totalWords = 0;
            int stillToRevise = 0;

            for (Card c : cards) {
                if (!c.userId.equals(userId)) continue;
                if (!"All".equalsIgnoreCase(groupName) && !c.groupName.equalsIgnoreCase(groupName)) continue;
                totalWords++;
            }

            for (Srs s : srsStates) {
                if (!s.userId.equals(userId)) continue;
                Card c = card(userId, s.cardId);
                if (c == null || !"ready".equals(c.status)) continue;
                if (!"All".equalsIgnoreCase(groupName) && !c.groupName.equalsIgnoreCase(groupName)) continue;
                if (!Instant.parse(s.dueAt).isAfter(now)) stillToRevise++;
            }

            if (groupsJson.length() > 0) groupsJson.append(',');
            groupsJson.append(String.format("{\"groupName\":\"%s\",\"totalWords\":%d,\"stillToRevise\":%d}", esc(groupName), totalWords, stillToRevise));
        }

        int totalWords = 0, reviewedToday = 0, stillToRevise = 0;
        for (Card c : cards) {
            if (!c.userId.equals(userId)) continue;
            if (!"All".equalsIgnoreCase(selectedGroup) && !c.groupName.equalsIgnoreCase(selectedGroup)) continue;
            totalWords++;
        }

        for (Review r : reviews) {
            if (!r.userId.equals(userId) || !r.reviewedAt.startsWith(day)) continue;
            Card c = card(userId, r.cardId);
            if (c == null) continue;
            if (!"All".equalsIgnoreCase(selectedGroup) && !c.groupName.equalsIgnoreCase(selectedGroup)) continue;
            reviewedToday++;
        }

        for (Srs s : srsStates) {
            if (!s.userId.equals(userId)) continue;
            Card c = card(userId, s.cardId);
            if (c == null || !"ready".equals(c.status)) continue;
            if (!"All".equalsIgnoreCase(selectedGroup) && !c.groupName.equalsIgnoreCase(selectedGroup)) continue;
            if (!Instant.parse(s.dueAt).isAfter(now)) stillToRevise++;
        }

        int estimatedMinutes = stillToRevise == 0 ? 0 : Math.max(1, (int) Math.ceil(stillToRevise * 0.5));

        send(ex, 200, String.format(
                "{\"selectedGroup\":\"%s\",\"totalWords\":%d,\"reviewedToday\":%d,\"stillToRevise\":%d,\"estimatedMinutes\":%d,\"groups\":[%s]}",
                esc(selectedGroup), totalWords, reviewedToday, stillToRevise, estimatedMinutes, groupsJson
        ));
    }

    static void stats(HttpExchange ex, String userId) throws IOException {
        int total=0, reviewsToday=0, known=0, unknown=0, dueToday=0;
        String day = LocalDate.now(ZoneOffset.UTC).toString();
        for(Card c:cards) if(c.userId.equals(userId)) total++;
        for(Review r:reviews) if(r.userId.equals(userId) && r.reviewedAt.startsWith(day)){ reviewsToday++; if("known".equals(r.result)) known++; else unknown++; }
        Instant now=Instant.now();
        for(Srs s:srsStates) if(s.userId.equals(userId) && !Instant.parse(s.dueAt).isAfter(now)) dueToday++;
        send(ex,200,String.format("{\"totalCards\":%d,\"reviewsToday\":%d,\"known\":%d,\"unknown\":%d,\"dueToday\":%d}",total,reviewsToday,known,unknown,dueToday));
    }

    static void generate(Card c, Profile p){
        for(Content x:contents) if(x.cardId.equals(c.id)&&x.knownLanguage.equals(p.knownLanguage)&&x.level.equals(p.level)){ c.status="ready"; return; }

        Content cc = null;
        if (OPENAI_API_KEY != null && !OPENAI_API_KEY.isBlank()) {
            cc = generateWithOpenAI(c, p);
        }

        if (cc == null) {
            cc = new Content();
            cc.cardId=c.id; cc.knownLanguage=p.knownLanguage; cc.level=p.level;
            cc.meaningTarget=c.text+" ("+c.targetLanguage+") short meaning";
            cc.meaningKnown=c.text+" ("+p.knownLanguage+") short meaning";
            cc.sentenceTarget="I use "+c.text+" in class every day";
            cc.sentenceKnown="Translation: I use "+c.text+" in class every day";
            cc.createdAt=now();
        }

        contents.add(cc);
        c.status="ready";
    }

    static Content generateWithOpenAI(Card c, Profile p) {
        String prompt = "Generate strict JSON with exactly these keys: meaningTarget, meaningKnown, sentenceTarget, sentenceKnown. " +
                "Target language=" + c.targetLanguage + ", known language=" + p.knownLanguage + ", level=" + p.level + ". " +
                "Word/phrase=\"" + c.text + "\". sentenceTarget must naturally include the word/phrase and be exactly one sentence.";

        String payload = "{" +
                "\"model\":\"" + esc(OPENAI_MODEL) + "\"," +
                "\"temperature\":0.4," +
                "\"response_format\":{\"type\":\"json_object\"}," +
                "\"messages\":[" +
                "{\"role\":\"system\",\"content\":\"You are a language tutor. Return only valid JSON.\"}," +
                "{\"role\":\"user\",\"content\":\"" + esc(prompt) + "\"}" +
                "]}";

        for (int i = 0; i < 3; i++) {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                        .header("Authorization", "Bearer " + OPENAI_API_KEY)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload))
                        .build();

                HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) continue;

                String contentJson = extractAssistantContent(resp.body());
                if (contentJson == null || contentJson.isBlank()) continue;

                Map<String, String> parsed = parseJson(contentJson);
                if (!isValidGeneratedContent(parsed, c.text)) continue;

                Content cc = new Content();
                cc.cardId = c.id;
                cc.knownLanguage = p.knownLanguage;
                cc.level = p.level;
                cc.meaningTarget = parsed.get("meaningTarget").trim();
                cc.meaningKnown = parsed.get("meaningKnown").trim();
                cc.sentenceTarget = parsed.get("sentenceTarget").trim();
                cc.sentenceKnown = parsed.get("sentenceKnown").trim();
                cc.createdAt = now();
                return cc;
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    static boolean isValidGeneratedContent(Map<String, String> m, String text) {
        if (m == null) return false;
        Set<String> req = Set.of("meaningTarget", "meaningKnown", "sentenceTarget", "sentenceKnown");
        if (!m.keySet().containsAll(req)) return false;
        for (String k : req) {
            String v = m.get(k);
            if (v == null || v.trim().isEmpty()) return false;
        }
        String sentence = m.get("sentenceTarget").trim();
        if (!sentence.toLowerCase().contains(text.toLowerCase())) return false;
        return true;
    }

    static String extractAssistantContent(String responseBody) {
        String marker = "\"content\":\"";
        int start = responseBody.indexOf(marker);
        if (start < 0) return null;
        int i = start + marker.length();
        StringBuilder out = new StringBuilder();
        boolean escape = false;
        while (i < responseBody.length()) {
            char ch = responseBody.charAt(i++);
            if (escape) {
                if (ch == 'n') out.append('\n');
                else out.append(ch);
                escape = false;
                continue;
            }
            if (ch == '\\') {
                escape = true;
                continue;
            }
            if (ch == '"') break;
            out.append(ch);
        }
        return out.toString().trim();
    }

    static void review(String userId, String cardId, String result){
        Review r=new Review(); r.userId=userId; r.cardId=cardId; r.result=result; r.reviewedAt=now(); reviews.add(r);
        for(Srs s:srsStates) if(s.userId.equals(userId)&&s.cardId.equals(cardId)){
            if("known".equals(result)) s.intervalDays=Math.max(1,Math.round(s.intervalDays*2)); else s.intervalDays=1;
            s.dueAt=Instant.now().plusSeconds(86400L*s.intervalDays).toString(); s.updatedAt=now();
        }
    }

    static String auth(HttpExchange ex){
        String h=ex.getRequestHeaders().getFirst("Authorization");
        if(h==null||!h.startsWith("Bearer ")) return null;
        return tokens.get(h.substring(7));
    }

    static Profile profile(String userId){ for(Profile p:profiles) if(p.userId.equals(userId)) return p; return null; }
    static Card card(String userId, String id){ for(Card c:cards) if(c.userId.equals(userId)&&c.id.equals(id)) return c; return null; }
    static int dailyCount(String userId){ String d=LocalDate.now(ZoneOffset.UTC).toString(); int n=0; for(Card c:cards) if(c.userId.equals(userId)&&c.createdAt.startsWith(d)) n++; return n; }

    static void cors(HttpExchange ex){ Headers h=ex.getResponseHeaders(); h.add("Content-Type","application/json"); h.add("Access-Control-Allow-Origin","*"); h.add("Access-Control-Allow-Headers","Content-Type, Authorization"); h.add("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS"); }
    static void send(HttpExchange ex, int code, String body) throws IOException { byte[] b=body.getBytes(StandardCharsets.UTF_8); ex.sendResponseHeaders(code,b.length); try(OutputStream os=ex.getResponseBody()){ os.write(b);} }
    static String readBody(HttpExchange ex) throws IOException { try(InputStream is=ex.getRequestBody()){ return new String(is.readAllBytes(), StandardCharsets.UTF_8);} }
    static String now(){ return Instant.now().toString(); }
    static String uuid(){ return UUID.randomUUID().toString(); }
    static int toInt(String s, int d){ try{return Integer.parseInt(s);}catch(Exception e){return d;} }
    static String esc(String s){ return s.replace("\\","\\\\").replace("\"","\\\""); }

    static Map<String,String> query(URI uri){
        Map<String,String> out=new HashMap<>();
        String q=uri.getRawQuery(); if(q==null||q.isEmpty()) return out;
        for(String p:q.split("&")){ String[] kv=p.split("=",2); out.put(urlDecode(kv[0]), kv.length>1?urlDecode(kv[1]):""); }
        return out;
    }

    static String urlDecode(String x){ return java.net.URLDecoder.decode(x, StandardCharsets.UTF_8); }

    static Map<String,String> parseJson(String raw){
        Map<String,String> m=new HashMap<>();
        String s=raw.trim();
        if(!s.startsWith("{")||!s.endsWith("}")) return m;
        s=s.substring(1,s.length()-1).trim();
        if(s.isEmpty()) return m;
        List<String> parts=new ArrayList<>();
        StringBuilder cur=new StringBuilder(); boolean in=false;
        for(int i=0;i<s.length();i++){
            char c=s.charAt(i);
            if(c=='\"' && (i==0||s.charAt(i-1)!='\\')) in=!in;
            if(c==',' && !in){ parts.add(cur.toString()); cur.setLength(0);} else cur.append(c);
        }
        parts.add(cur.toString());
        for(String p:parts){
            String[] kv=p.split(":",2); if(kv.length<2) continue;
            String k=strip(kv[0]); String v=strip(kv[1]); m.put(k,v);
        }
        return m;
    }

    static String strip(String x){
        String s=x.trim();
        if(s.startsWith("\"")&&s.endsWith("\"")) s=s.substring(1,s.length()-1);
        return s.replace("\\\"","\"");
    }
}
