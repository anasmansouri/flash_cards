export const SUPPORTED_LANGUAGES = ["en", "fr", "de", "it", "es"];
export const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
export const STATUS = { GENERATING: "generating", READY: "ready", FAILED: "failed" };
export const COMPLEX_CONNECTORS = {
  en: ["although", "moreover", "nevertheless", "consequently"],
  fr: ["cependant", "néanmoins", "toutefois", "par conséquent"],
  de: ["obwohl", "dennoch", "folglich", "hingegen"],
  it: ["tuttavia", "ciononostante", "pertanto", "sebbene"],
  es: ["sin embargo", "no obstante", "por consiguiente", "aunque"]
};
export const LEVEL_WORD_LIMITS = {
  A1: [5, 8],
  A2: [6, 10],
  B1: [8, 14],
  B2: [12, 18],
  C1: [16, 24]
};
