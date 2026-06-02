// Copilot Studio bot mesajları sık sık ham HTML satır-sonu etiketleri
// (<br>, <br/>, <hr>) içerir. Markdown renderer'larımız ham HTML'i kapalı
// tutuyor (react-markdown rehype-raw yok; markdown-it html:false) — bu yüzden
// etiketler düz METİN olarak görünür. Render'dan önce CommonMark karşılıklarına
// çeviriyoruz: <br> → iki boşluk + newline (markdown "hard break"),
// <hr> → yatay çizgi (---). Ham HTML enjeksiyonu açmadığı için XSS güvenli.
export function normalizeBotMarkdown(text) {
  if (typeof text !== "string") return text ?? ""
  return text
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<hr\s*\/?>/gi, "\n\n---\n\n")
}
