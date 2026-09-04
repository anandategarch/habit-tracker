// Extracted from src/app/api/learning/article/route.ts — LLM summarization helper.

import ZAI from 'z-ai-web-dev-sdk';

export async function summarizeArticle(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  pageTitle: string,
  pageText: string,
  topic: string,
): Promise<{ title: string; content: string; funFact: string }> {
  try {
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Kamu adalah penulis artikel edukasi keuangan dan ekonomi profesional. Tugasmu adalah membuat ringkasan artikel edukatif yang PANJANG dan KOMPREHENSIF dalam bahasa Indonesia.

FORMAT OUTPUT (WAJIB JSON valid, tanpa markdown code block):
{
  "title": "Judul artikel yang menarik dan informatif",
  "content": "Ringkasan artikel 500-700 kata dalam bahasa Indonesia. WAJIB minimal 500 kata. Tulis dalam 5-7 paragraf yang mengalir secara naratif. Jelas, detail, dan mudah dipahami. Berikan contoh konkret, data statistik, dan penjelasan mendalam. JANGAN gunakan format list/bullet/numbering. Gunakan paragraf naratif yang padat dan informatif. Setiap paragraf harus memiliki substansi yang kuat. Setiap paragraf minimal 3-4 kalimat.",
  "funFact": "Satu fakta menarik terkait topik dalam 1-2 kalimat. Bisa berupa data statistik mengejutkan, sejarah yang jarang diketahui, atau trivia yang menginspirasi."
}

PERINGATAN KETAT:
- Konten HARUS PANJANG dan DETAIL, minimal 500 kata, target ideal 600-700 kata
- Hitung kata-katamu! Jangan berhenti sebelum mencapai 500 kata minimum
- Jangan ulang-ulang poin yang sama — kembangkan setiap ide secara mendalam
- Berikan kedalaman penjelasan, contoh nyata, dan konteks yang luas
- Gunakan transisi yang natural antar paragraf
- Setiap paragraf HARUS memiliki 3-5 kalimat yang substansial
- JANGAN gunakan poin-poin atau daftar — tulis dalam format paragraf naratif
- Output HANYA JSON valid, tanpa teks tambahan apapun sebelum atau sesudah`,
        },
        {
          role: 'user',
          content: `Buatkan ringkasan edukatif yang SANGAT PANJANG (minimal 500 kata, idealnya 600-700 kata) dan mendalam tentang topik "${topic}" berdasarkan konten berikut. Kamu HARUS menulis minimal 5 paragraf panjang:

Judul: ${pageTitle}
Konten: ${pageText.substring(0, 12000)}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const raw = completion.choices[0]?.message?.content?.trim() || '';
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.title && parsed.content && parsed.funFact) {
        return {
          title: parsed.title,
          content: parsed.content,
          funFact: parsed.funFact,
        };
      }
    }
  } catch (e) {
    console.error('Summarization failed:', e);
  }
  return { title: '', content: '', funFact: '' };
}
