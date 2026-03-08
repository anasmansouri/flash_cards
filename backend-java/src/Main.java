import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.Serializable;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.regex.Pattern;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.concurrent.Executors;

public class Main {
    static final Set<String> KNOWN_LANGUAGES = Set.of("en", "fr", "it", "es");
    static final Set<String> LEVELS = Set.of("A1", "A2", "B1", "B2", "C1", "C2");
    static final String LEARNING_LANGUAGE = "de";
    static final String DEFAULT_GROUP = "Default";
    static final String OPENAI_API_KEY = System.getenv("OPENAI_API_KEY");
    static final String OPENAI_MODEL = System.getenv().getOrDefault("OPENAI_MODEL", "gpt-4o-mini");
    static final HttpClient HTTP = HttpClient.newHttpClient();
    static final String DATA_FILE = "backend-java/data/state.bin";
    static final Pattern EMAIL_RE = Pattern.compile("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$");

    static class User implements Serializable { String id, email, password, plan, createdAt; }
    static class Profile implements Serializable { String userId, knownLanguage, level; }
    static class Card implements Serializable { String id, userId, text, status, createdAt, groupName; }
    static class Content implements Serializable { String cardId, knownLanguage, level, meaningTarget, meaningKnown, sentenceTarget, sentenceKnown, source, model, generationError, createdAt; }
    static class Review implements Serializable { String userId, cardId, result, reviewedAt; }
    static class Srs implements Serializable { String userId, cardId, dueAt; int intervalDays; String updatedAt; }
    static class Event implements Serializable { String id, userId, name, createdAt; }
    static class StateSnapshot implements Serializable {
        List<User> users = new ArrayList<>();
        List<Profile> profiles = new ArrayList<>();
        List<Card> cards = new ArrayList<>();
        List<Content> contents = new ArrayList<>();
        List<Review> reviews = new ArrayList<>();
        List<Srs> srsStates = new ArrayList<>();
        List<Event> events = new ArrayList<>();
        Map<String, String> tokens = new HashMap<>();
    }

    static final List<User> users = new ArrayList<>();
    static final List<Profile> profiles = new ArrayList<>();
    static final List<Card> cards = new ArrayList<>();
    static final List<Content> contents = new ArrayList<>();
    static final List<Review> reviews = new ArrayList<>();
    static final List<Srs> srsStates = new ArrayList<>();
    static final List<Event> events = new ArrayList<>();
    static final Map<String, String> tokens = new HashMap<>();
    static final Map<String, List<Long>> authAttempts = new HashMap<>();
    static final long startedAtMs = System.currentTimeMillis();

    static class GenerationAttempt {
        Content content;
        String error = "";
    }


    public static void main(String[] args) throws Exception {
        loadState();
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
            if (path.equals("/api/health") && method.equals("GET")) { health(ex); return; }
            if (path.equals("/api/auth/signup") && method.equals("POST")) { signup(ex); return; }
            if (path.equals("/api/auth/login") && method.equals("POST")) { login(ex); return; }
            if (path.equals("/api/auth/forgot-password") && method.equals("POST")) { send(ex,200,"{\"ok\":true}"); return; }

            String userId = auth(ex);
            if (userId == null) { send(ex, 401, "{\"error\":\"UNAUTHORIZED\"}"); return; }

            if (path.equals("/api/profile") && method.equals("GET")) { getProfile(ex, userId); return; }
            if (path.equals("/api/profile") && method.equals("PATCH")) { patchProfile(ex, userId); return; }
            if (path.equals("/api/subscription") && method.equals("GET")) { getSubscription(ex, userId); return; }
            if (path.equals("/api/subscription") && method.equals("PATCH")) { patchSubscription(ex, userId); return; }

            if (path.equals("/api/groups") && method.equals("GET")) { groups(ex, userId); return; }
            if (path.matches("/api/groups/[^/]+/cards") && method.equals("DELETE")) { deleteGroupCards(ex, userId, urlDecode(path.split("/")[3])); return; }
            if (path.matches("/api/groups/[^/]+") && method.equals("DELETE")) { deleteGroup(ex, userId, urlDecode(path.split("/")[3])); return; }
            if (path.equals("/api/cards") && method.equals("POST")) { createCard(ex, userId); return; }
            if (path.equals("/api/cards") && method.equals("GET")) { listCards(ex, userId); return; }
            if (path.equals("/api/session/next") && method.equals("GET")) { sessionNext(ex, userId); return; }
            if (path.equals("/api/review/summary") && method.equals("GET")) { reviewSummary(ex, userId); return; }
            if (path.equals("/api/stats") && method.equals("GET")) { stats(ex, userId); return; }
            if (path.equals("/api/events") && method.equals("POST")) { createEvent(ex, userId); return; }
            if (path.equals("/api/events") && method.equals("GET")) { listEvents(ex, userId); return; }
            if (path.equals("/api/account/export") && method.equals("GET")) { accountExport(ex, userId); return; }
            if (path.equals("/api/account") && method.equals("DELETE")) { deleteAccount(ex, userId); return; }

            if (path.matches("/api/cards/[^/]+") && method.equals("DELETE")) { deleteCard(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/retry") && method.equals("POST")) { retryCard(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/known") && method.equals("POST")) { known(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/unknown") && method.equals("POST")) { unknown(ex, userId, path.split("/")[3]); return; }
            if (path.matches("/api/cards/[^/]+/generation") && method.equals("GET")) { generationStatus(ex, userId, path.split("/")[3]); return; }

            send(ex, 404, "{\"error\":\"NOT_FOUND\"}");
        } catch (Exception e) {
            send(ex, 500, "{\"error\":\"INTERNAL\"}");
        }
    }

    static void health(HttpExchange ex) throws IOException {
        send(ex,200,String.format("{\"ok\":true,\"uptimeSeconds\":%d,\"users\":%d,\"cards\":%d}",(System.currentTimeMillis()-startedAtMs)/1000,users.size(),cards.size()));
    }

    static void signup(HttpExchange ex) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String email=b.get("email"), pass=b.get("password");
        if (isRateLimited(email)) { send(ex,429,"{\"error\":\"RATE_LIMITED\",\"message\":\"Too many auth attempts. Try again later.\"}"); return; }
        if (!isValidEmail(email) || !isStrongPassword(pass)) { registerAuthAttempt(email); send(ex,400,"{\"error\":\"INVALID_INPUT\",\"message\":\"Provide valid email and password (min 8 chars, with letters and numbers).\"}"); return; }
        for (User u: users) if (u.email.equalsIgnoreCase(email)) { registerAuthAttempt(email); send(ex,409,"{\"error\":\"EMAIL_EXISTS\"}"); return; }
        User u = new User(); u.id=uuid(); u.email=email.toLowerCase(Locale.ROOT); u.password=hashPassword(pass); u.plan="free"; u.createdAt=now(); users.add(u);
        String token=uuid(); tokens.put(token,u.id);
        clearAuthAttempts(email);
        persistState();
        send(ex,200,"{\"token\":\""+token+"\"}");
    }

    static void login(HttpExchange ex) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String email=b.get("email"), pass=b.get("password");
        if (isRateLimited(email)) { send(ex,429,"{\"error\":\"RATE_LIMITED\",\"message\":\"Too many auth attempts. Try again later.\"}"); return; }
        if (!isValidEmail(email) || pass==null) { registerAuthAttempt(email); send(ex,400,"{\"error\":\"INVALID_INPUT\"}"); return; }
        for (User u: users) if (u.email.equalsIgnoreCase(email) && verifyPassword(pass, u.password)) {
            String token=uuid(); tokens.put(token,u.id);
            clearAuthAttempts(email);
            persistState();
            send(ex,200,"{\"token\":\""+token+"\"}"); return;
        }
        registerAuthAttempt(email);
        send(ex,401,"{\"error\":\"INVALID_CREDENTIALS\"}");
    }

    static void getProfile(HttpExchange ex, String userId) throws IOException {
        Profile p = profile(userId);
        if (p==null) { send(ex,404,"{\"error\":\"PROFILE_NOT_FOUND\"}"); return; }
        User u = userById(userId);
        String plan = (u == null || u.plan == null || u.plan.isBlank()) ? "free" : u.plan;
        send(ex,200,String.format("{\"knownLanguage\":\"%s\",\"targetLanguage\":\"%s\",\"level\":\"%s\",\"plan\":\"%s\"}", p.knownLanguage,LEARNING_LANGUAGE,p.level,plan));
    }

    static void patchProfile(HttpExchange ex, String userId) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String known=b.get("knownLanguage"), level=b.get("level");
        if (!KNOWN_LANGUAGES.contains(known) || !LEVELS.contains(level)) { send(ex,400,"{\"error\":\"INVALID_INPUT\"}"); return; }
        Profile p=profile(userId); if (p==null){ p=new Profile(); p.userId=userId; profiles.add(p); }
        p.knownLanguage=known; p.level=level;
        persistState();
        User u = userById(userId);
        String plan = (u == null || u.plan == null || u.plan.isBlank()) ? "free" : u.plan;
        send(ex,200,String.format("{\"knownLanguage\":\"%s\",\"targetLanguage\":\"%s\",\"level\":\"%s\",\"plan\":\"%s\"}", known,LEARNING_LANGUAGE,level,plan));
    }


    static void getSubscription(HttpExchange ex, String userId) throws IOException {
        User u = userById(userId);
        String plan = (u == null || u.plan == null || u.plan.isBlank()) ? "free" : u.plan;
        send(ex,200,String.format("{\"plan\":\"%s\"}", plan));
    }

    static void patchSubscription(HttpExchange ex, String userId) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String plan = b.get("plan");
        if (plan == null || (!"free".equals(plan) && !"premium".equals(plan))) {
            send(ex,400,"{\"error\":\"INVALID_PLAN\"}");
            return;
        }
        User u = userById(userId);
        if (u == null) { send(ex,404,"{\"error\":\"NOT_FOUND\"}"); return; }
        u.plan = plan;
        persistState();
        send(ex,200,String.format("{\"plan\":\"%s\"}", plan));
    }

    static boolean dailyLimitReached(String userId) {
        User u = userById(userId);
        boolean premium = u != null && "premium".equals(u.plan);
        return !premium && dailyCount(userId) >= 10;
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
        if (dailyLimitReached(userId)){ send(ex,429,"{\"error\":\"DAILY_LIMIT_REACHED\",\"message\":\"Daily word generation limit reached for free plan. Upgrade to premium for unlimited words.\"}"); return; }

        String groupMode = b.getOrDefault("groupMode", "default");
        String groupName = resolveGroup(userId, groupMode, b.get("groupName"));
        if (groupName == null) {
            send(ex, 400, "{\"error\":\"GROUP_INVALID\",\"message\":\"Group selection is invalid.\"}");
            return;
        }

        for (Card existing : cards) {
            if (!existing.userId.equals(userId)) continue;
            if (!existing.groupName.equalsIgnoreCase(groupName)) continue;
            if (existing.text.equalsIgnoreCase(text)) {
                send(ex, 409, "{\"error\":\"DUPLICATE_CARD\",\"message\":\"This word already exists in the selected group.\"}");
                return;
            }
        }

        Card c=new Card();
        c.id=uuid(); c.userId=userId; c.text=text; c.status="generating"; c.createdAt=now(); c.groupName=groupName;
        cards.add(c);

        Srs s=new Srs(); s.userId=userId; s.cardId=c.id; s.intervalDays=1; s.dueAt=now(); s.updatedAt=now(); srsStates.add(s);
        Content generated = generate(c,p);
        persistState();
        send(ex,200,"{\"cardId\":\""+c.id+"\",\"status\":\""+c.status+"\",\"groupName\":\""+esc(groupName)+"\",\"generationSource\":\""+esc(generated.source)+"\",\"generationModel\":\""+esc(generated.model)+"\",\"generationError\":\""+esc(generated.generationError == null ? "" : generated.generationError)+"\"}");
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
        persistState();
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
        persistState();
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

        persistState();
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
        contents.removeIf(x -> x.cardId.equals(id) && x.knownLanguage.equals(p.knownLanguage) && x.level.equals(p.level));
        c.status="generating"; Content generated = generate(c,p);
        persistState();
        send(ex,200,"{\"status\":\""+c.status+"\",\"generationSource\":\""+esc(generated.source)+"\",\"generationModel\":\""+esc(generated.model)+"\",\"generationError\":\""+esc(generated.generationError == null ? "" : generated.generationError)+"\"}");
    }

    static void generationStatus(HttpExchange ex, String userId, String cardId) throws IOException {
        Card c = card(userId, cardId);
        if (c == null) { send(ex,404,"{\"error\":\"NOT_FOUND\"}"); return; }
        Profile p = profile(userId);
        if (p == null) { send(ex,400,"{\"error\":\"PROFILE_REQUIRED\"}"); return; }
        Content found = null;
        for (Content x : contents) {
            if (x.cardId.equals(cardId) && x.knownLanguage.equals(p.knownLanguage) && x.level.equals(p.level)) { found = x; break; }
        }
        if (found == null) { send(ex,404,"{\"error\":\"CONTENT_NOT_FOUND\"}"); return; }
        send(ex,200,String.format("{\"source\":\"%s\",\"model\":\"%s\",\"error\":\"%s\"}", esc(found.source), esc(found.model), esc(found.generationError == null ? "" : found.generationError)));
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
            if(c==null || !"ready".equals(c.status)) continue;
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

    static void createEvent(HttpExchange ex, String userId) throws IOException {
        Map<String,String> b = parseJson(readBody(ex));
        String name = b.getOrDefault("name", "").trim();
        if (name.isEmpty() || name.length() > 80) { send(ex,400,"{\"error\":\"INVALID_EVENT\"}"); return; }
        Event e = new Event();
        e.id = uuid();
        e.userId = userId;
        e.name = name;
        e.createdAt = now();
        events.add(e);
        persistState();
        send(ex,200,"{\"ok\":true}");
    }

    static void listEvents(HttpExchange ex, String userId) throws IOException {
        StringBuilder items = new StringBuilder();
        int total = 0;
        for (Event e : events) {
            if (!e.userId.equals(userId)) continue;
            if (items.length() > 0) items.append(',');
            items.append(String.format("{\"eventId\":\"%s\",\"name\":\"%s\",\"createdAt\":\"%s\"}", e.id, esc(e.name), e.createdAt));
            total++;
        }
        send(ex,200,String.format("{\"items\":[%s],\"total\":%d}", items, total));
    }

    static void accountExport(HttpExchange ex, String userId) throws IOException {
        Profile p = profile(userId);
        User u = userById(userId);
        String profileJson = p == null ? "null" : String.format("{\"knownLanguage\":\"%s\",\"level\":\"%s\"}", p.knownLanguage, p.level);
        int cardCount = 0;
        int reviewCount = 0;
        for (Card c : cards) if (c.userId.equals(userId)) cardCount++;
        for (Review r : reviews) if (r.userId.equals(userId)) reviewCount++;
        String plan = (u == null || u.plan == null || u.plan.isBlank()) ? "free" : u.plan;
        send(ex,200,String.format("{\"email\":\"%s\",\"plan\":\"%s\",\"profile\":%s,\"cardCount\":%d,\"reviewCount\":%d}", esc(u == null ? "" : u.email), plan, profileJson, cardCount, reviewCount));
    }

    static void deleteAccount(HttpExchange ex, String userId) throws IOException {
        tokens.entrySet().removeIf(e -> userId.equals(e.getValue()));
        users.removeIf(u -> userId.equals(u.id));
        profiles.removeIf(p -> userId.equals(p.userId));
        List<String> ids = new ArrayList<>();
        for (Card c : cards) if (userId.equals(c.userId)) ids.add(c.id);
        for (String id : ids) removeCardData(userId, id);
        reviews.removeIf(r -> userId.equals(r.userId));
        srsStates.removeIf(s -> userId.equals(s.userId));
        events.removeIf(e -> userId.equals(e.userId));
        persistState();
        send(ex,200,"{\"ok\":true}");
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

    static Content generate(Card c, Profile p){
        for(Content x:contents) if(x.cardId.equals(c.id)&&x.knownLanguage.equals(p.knownLanguage)&&x.level.equals(p.level)){ c.status="ready"; return x; }

        Content cc = null;
        String openAiFailure;
        if (OPENAI_API_KEY != null && !OPENAI_API_KEY.isBlank()) {
            GenerationAttempt attempt = generateWithOpenAI(c, p);
            cc = attempt.content;
            openAiFailure = (attempt.error == null || attempt.error.isBlank()) ? "openai_generation_unknown_error" : attempt.error;
        } else {
            openAiFailure = "openai_key_missing";
        }

        if (cc == null) {
            cc = new Content();
            cc.cardId=c.id; cc.knownLanguage=p.knownLanguage; cc.level=p.level;
            cc.meaningTarget = germanMeaningFallback(c.text);
            cc.meaningKnown = knownMeaningFallback(c.text, p.knownLanguage);
            cc.sentenceTarget="Ich benutze "+c.text+" jeden Tag im Unterricht";
            cc.sentenceKnown = knownSentenceFallback(c.text, p.knownLanguage);
            cc.source="demo";
            cc.model="demo-fallback";
            cc.generationError = openAiFailure;
            cc.createdAt=now();
        }

        contents.add(cc);
        c.status="ready";
        return cc;
    }


    static String germanMeaningFallback(String text) {
        return "Bedeutung von " + text + ": etwas tun oder fortsetzen";
    }

    static String knownMeaningFallback(String text, String knownLanguage) {
        switch (knownLanguage) {
            case "fr":
                return "Signification de " + text + " : faire une action ou une tâche";
            case "it":
                return "Significato di " + text + " : fare un'azione o un compito";
            case "es":
                return "Significado de " + text + " : realizar una acción o una tarea";
            default:
                return "Meaning of " + text + ": to perform an action or task";
        }
    }

    static String knownSentenceFallback(String text, String knownLanguage) {
        switch (knownLanguage) {
            case "fr":
                return "J'utilise " + text + " tous les jours en classe";
            case "it":
                return "Uso " + text + " ogni giorno in classe";
            case "es":
                return "Uso " + text + " todos los días en clase";
            default:
                return "I use " + text + " every day in class";
        }
    }

    static GenerationAttempt generateWithOpenAI(Card c, Profile p) {
        String prompt = "Generate strict JSON with exactly these keys: meaningTarget, meaningKnown, sentenceTarget, sentenceKnown. " +
                "Target language=" + LEARNING_LANGUAGE + ", known language=" + p.knownLanguage + ", level=" + p.level + ". " +
                "Word/phrase=\"" + c.text + "\". sentenceTarget must naturally include the word/phrase and be exactly one sentence. " +
                "meaningTarget and sentenceTarget must be in German. meaningKnown and sentenceKnown must be strictly in the known language (" + p.knownLanguage + ") and never in English unless known language is en.";

        String payload = "{" +
                "\"model\":\"" + esc(OPENAI_MODEL) + "\"," +
                "\"temperature\":0.4," +
                "\"response_format\":{\"type\":\"json_object\"}," +
                "\"messages\":[" +
                "{\"role\":\"system\",\"content\":\"You are a language tutor. Return only valid JSON.\"}," +
                "{\"role\":\"user\",\"content\":\"" + esc(prompt) + "\"}" +
                "]}";

        GenerationAttempt attempt = new GenerationAttempt();

        for (int i = 0; i < 3; i++) {
            try {
                HttpRequest req = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.openai.com/v1/chat/completions"))
                        .header("Authorization", "Bearer " + OPENAI_API_KEY)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload))
                        .build();

                HttpResponse<String> resp = HTTP.send(req, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() < 200 || resp.statusCode() >= 300) {
                    String body = resp.body() == null ? "" : resp.body();
                    attempt.error = "openai_http_" + resp.statusCode() + ":" + body.substring(0, Math.min(160, body.length()));
                    continue;
                }

                String contentJson = extractAssistantContent(resp.body());
                if (contentJson == null || contentJson.isBlank()) {
                    String body = resp.body() == null ? "" : resp.body();
                    attempt.error = "openai_empty_content:" + body.substring(0, Math.min(160, body.length()));
                    continue;
                }

                Map<String, String> parsed = parseJson(contentJson);
                if (!isValidGeneratedContent(parsed, c.text)) {
                    attempt.error = "openai_invalid_content_format";
                    continue;
                }

                Content cc = new Content();
                cc.cardId = c.id;
                cc.knownLanguage = p.knownLanguage;
                cc.level = p.level;
                cc.meaningTarget = parsed.get("meaningTarget").trim();
                cc.meaningKnown = parsed.get("meaningKnown").trim();
                cc.sentenceTarget = parsed.get("sentenceTarget").trim();
                cc.sentenceKnown = parsed.get("sentenceKnown").trim();
                cc.source = "openai";
                cc.model = OPENAI_MODEL;
                cc.createdAt = now();
                attempt.content = cc;
                return attempt;
            } catch (Exception e) {
                String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                attempt.error = "openai_exception:" + msg.substring(0, Math.min(160, msg.length()));
            }
        }
        return attempt;
    }

    static boolean isValidGeneratedContent(Map<String, String> m, String text) {
        if (m == null) return false;
        Set<String> req = Set.of("meaningTarget", "meaningKnown", "sentenceTarget", "sentenceKnown");
        if (!m.keySet().equals(req)) return false;
        for (String k : req) {
            String v = m.get(k);
            if (v == null || v.trim().isEmpty()) return false;
        }
        String sentence = m.get("sentenceTarget").trim();
        if (!sentence.toLowerCase().contains(text.toLowerCase())) return false;
        if (sentence.split("[.!?]").length > 2) return false;
        return true;
    }

    static String extractAssistantContent(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) return null;

        String direct = extractJsonStringValueByKey(responseBody, "content");
        if (direct != null && !direct.isBlank()) return direct.trim();

        // Some responses serialize content as an array with text parts.
        String textPart = extractJsonStringValueByKey(responseBody, "text");
        if (textPart != null && !textPart.isBlank()) return textPart.trim();

        return null;
    }

    static String extractJsonStringValueByKey(String raw, String key) {
        String token = "\"" + key + "\"";
        int pos = 0;
        while (true) {
            int keyIndex = raw.indexOf(token, pos);
            if (keyIndex < 0) return null;

            int colon = raw.indexOf(':', keyIndex + token.length());
            if (colon < 0) return null;

            int i = colon + 1;
            while (i < raw.length() && Character.isWhitespace(raw.charAt(i))) i++;

            // This helper reads string values only; skip non-string values.
            if (i >= raw.length() || raw.charAt(i) != '"') {
                pos = colon + 1;
                continue;
            }

            i++; // opening quote
            StringBuilder out = new StringBuilder();
            boolean escape = false;
            while (i < raw.length()) {
                char ch = raw.charAt(i++);
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
    }

    static void review(String userId, String cardId, String result){
        Review r=new Review(); r.userId=userId; r.cardId=cardId; r.result=result; r.reviewedAt=now(); reviews.add(r);
        for(Srs s:srsStates) if(s.userId.equals(userId)&&s.cardId.equals(cardId)){
            if("known".equals(result)) s.intervalDays=Math.max(1,Math.round(s.intervalDays*2)); else s.intervalDays=1;
            s.dueAt=Instant.now().plusSeconds(86400L*s.intervalDays).toString(); s.updatedAt=now();
        }
        persistState();
    }

    static boolean isRateLimited(String email) {
        if (email == null) return false;
        String key = email.toLowerCase(Locale.ROOT);
        List<Long> attempts = authAttempts.getOrDefault(key, new ArrayList<>());
        long now = System.currentTimeMillis();
        attempts.removeIf(ts -> now - ts > 10 * 60 * 1000L);
        authAttempts.put(key, attempts);
        return attempts.size() >= 10;
    }

    static void registerAuthAttempt(String email) {
        if (email == null) return;
        String key = email.toLowerCase(Locale.ROOT);
        List<Long> attempts = authAttempts.getOrDefault(key, new ArrayList<>());
        attempts.add(System.currentTimeMillis());
        authAttempts.put(key, attempts);
    }

    static void clearAuthAttempts(String email) {
        if (email == null) return;
        authAttempts.remove(email.toLowerCase(Locale.ROOT));
    }

    static boolean isValidEmail(String email) {
        return email != null && EMAIL_RE.matcher(email).matches();
    }

    static boolean isStrongPassword(String password) {
        if (password == null || password.length() < 8) return false;
        boolean hasLetter = false;
        boolean hasDigit = false;
        for (char c : password.toCharArray()) {
            if (Character.isLetter(c)) hasLetter = true;
            if (Character.isDigit(c)) hasDigit = true;
        }
        return hasLetter && hasDigit;
    }

    static String hashPassword(String password) {
        try {
            byte[] salt = new byte[16];
            new SecureRandom().nextBytes(salt);
            KeySpec spec = new PBEKeySpec(password.toCharArray(), salt, 65536, 256);
            byte[] hash = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return "pbkdf2$65536$" + Base64.getEncoder().encodeToString(salt) + "$" + Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new RuntimeException("hash_failure");
        }
    }

    static boolean verifyPassword(String raw, String stored) {
        try {
            if (stored == null) return false;
            if (!stored.startsWith("pbkdf2$")) return stored.equals(raw);
            String[] parts = stored.split("\\$");
            int iterations = Integer.parseInt(parts[1]);
            byte[] salt = Base64.getDecoder().decode(parts[2]);
            byte[] expected = Base64.getDecoder().decode(parts[3]);
            KeySpec spec = new PBEKeySpec(raw.toCharArray(), salt, iterations, expected.length * 8);
            byte[] actual = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
            return Arrays.equals(actual, expected);
        } catch (Exception e) {
            return false;
        }
    }

    static void loadState() {
        try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(DATA_FILE))) {
            StateSnapshot snapshot = (StateSnapshot) ois.readObject();
            users.clear(); users.addAll(snapshot.users);
            profiles.clear(); profiles.addAll(snapshot.profiles);
            cards.clear(); cards.addAll(snapshot.cards);
            contents.clear(); contents.addAll(snapshot.contents);
            reviews.clear(); reviews.addAll(snapshot.reviews);
            srsStates.clear(); srsStates.addAll(snapshot.srsStates);
            events.clear(); events.addAll(snapshot.events);
            tokens.clear(); tokens.putAll(snapshot.tokens);
        } catch (Exception ignored) {
            // First run or no persisted state yet.
        }
    }

    static synchronized void persistState() {
        try {
            java.io.File dir = new java.io.File("backend-java/data");
            if (!dir.exists()) dir.mkdirs();
            StateSnapshot snapshot = new StateSnapshot();
            snapshot.users.addAll(users);
            snapshot.profiles.addAll(profiles);
            snapshot.cards.addAll(cards);
            snapshot.contents.addAll(contents);
            snapshot.reviews.addAll(reviews);
            snapshot.srsStates.addAll(srsStates);
            snapshot.events.addAll(events);
            snapshot.tokens.putAll(tokens);
            try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(DATA_FILE))) {
                oos.writeObject(snapshot);
            }
        } catch (Exception ignored) {
            // Do not break request flow on persistence error in v2 beta.
        }
    }

    static String auth(HttpExchange ex){
        String h=ex.getRequestHeaders().getFirst("Authorization");
        if(h==null||!h.startsWith("Bearer ")) return null;
        return tokens.get(h.substring(7));
    }

    static User userById(String userId){ for(User u:users) if(u.id.equals(userId)) return u; return null; }
    static Profile profile(String userId){ for(Profile p:profiles) if(p.userId.equals(userId)) return p; return null; }
    static Card card(String userId, String id){ for(Card c:cards) if(c.userId.equals(userId)&&c.id.equals(id)) return c; return null; }
    static int dailyCount(String userId){ String d=LocalDate.now(ZoneOffset.UTC).toString(); int n=0; for(Card c:cards) if(c.userId.equals(userId)&&c.createdAt.startsWith(d)) n++; return n; }

    static void cors(HttpExchange ex){ Headers h=ex.getResponseHeaders(); h.add("Content-Type","application/json"); h.add("Access-Control-Allow-Origin","*"); h.add("Access-Control-Allow-Headers","Content-Type, Authorization"); h.add("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS"); h.add("X-Content-Type-Options","nosniff"); h.add("X-Frame-Options","DENY"); h.add("Referrer-Policy","no-referrer"); }
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
