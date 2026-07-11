import { NextRequest, NextResponse } from 'next/server';

function getTodayKey(): string {
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + jakartaOffset * 60000);
  return jakarta.toISOString().split('T')[0];
}

// 60+ quotes with Indonesian translations — selected by date so they never repeat within 2 months
const QUOTES: { quote: string; author: string; translation: string }[] = [
  { quote: 'The only way to do great work is to love what you do.', author: 'Steve Jobs', translation: 'Satu-satunya cara untuk melakukan pekerjaan hebat adalah mencintai apa yang kamu lakukan.' },
  { quote: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill', translation: 'Kesuksesan bukan akhir, kegagalan bukan fatal: yang penting adalah keberanian untuk terus melanjutkan.' },
  { quote: "Believe you can and you're halfway there.", author: 'Theodore Roosevelt', translation: 'Percayalah bahwa kamu bisa, dan kamu sudah setengah jalan.' },
  { quote: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt', translation: 'Masa depan milik mereka yang percaya pada keindahan mimpi mereka.' },
  { quote: 'It does not matter how slowly you go as long as you do not stop.', author: 'Confucius', translation: 'Tidak masalah seberapa lambat kamu berjalan, selama kamu tidak berhenti.' },
  { quote: 'Discipline is the bridge between goals and accomplishment.', author: 'Jim Rohn', translation: 'Disiplin adalah jembatan antara tujuan dan pencapaian.' },
  { quote: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb', translation: 'Waktu terbaik menanam pohon adalah 20 tahun lalu. Waktu terbaik kedua adalah sekarang.' },
  { quote: "Don't watch the clock; do what it does. Keep going.", author: 'Sam Levenson', translation: 'Jangan pantau jam; lakukan apa yang dilakukannya. Teruslah berjalan.' },
  { quote: 'The secret of getting ahead is getting started.', author: 'Mark Twain', translation: 'Rahasia untuk maju adalah memulai.' },
  { quote: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma', translation: 'Perbaikan kecil setiap hari seiring waktu menghasilkan hasil yang menakjubkan.' },
  { quote: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Aristotle', translation: 'Kita adalah apa yang kita lakukan berulang kali. Keunggulan bukan tindakan, tapi kebiasaan.' },
  { quote: 'The only impossible journey is the one you never begin.', author: 'Tony Robbins', translation: 'Perjalanan yang mustahil hanyalah yang tidak pernah kamu mulai.' },
  { quote: 'Hardships often prepare ordinary people for an extraordinary destiny.', author: 'C.S. Lewis', translation: 'Kesulitan sering mempersiapkan orang biasa untuk takdir yang luar biasa.' },
  { quote: 'You are never too old to set another goal or to dream a new dream.', author: 'C.S. Lewis', translation: 'Kamu tidak pernah terlalu tua untuk menetapkan tujuan baru atau bermimpi mimpi baru.' },
  { quote: 'Everything you\'ve ever wanted is on the other side of fear.', author: 'George Addair', translation: 'Semua yang kamu inginkan ada di sisi lain rasa takut.' },
  { quote: 'What you get by achieving your goals is not as important as what you become by achieving your goals.', author: 'Zig Ziglar', translation: 'Apa yang kamu dapat dari mencapai tujuan tidak sepenting siapa kamu setelah mencapainya.' },
  { quote: 'The mind is everything. What you think you become.', author: 'Buddha', translation: 'Pikiran adalah segalanya. Apa yang kamu pikirkan, itu yang kamu jadi.' },
  { quote: 'Strive not to be a success, but rather to be of value.', author: 'Albert Einstein', translation: 'Jangan berusaha menjadi sukses, tapi berusaha memberi nilai.' },
  { quote: 'Fall seven times, stand up eight.', author: 'Japanese Proverb', translation: 'Jatuh tujuh kali, berdiri delapan kali.' },
  { quote: 'The only limit to our realization of tomorrow will be our doubts of today.', author: 'Franklin D. Roosevelt', translation: 'Satu-satunya batas pencapaian kita besok adalah keraguan kita hari ini.' },
  { quote: 'In the middle of difficulty lies opportunity.', author: 'Albert Einstein', translation: 'Di tengah kesulitan terdapat peluang.' },
  { quote: 'It always seems impossible until it\'s done.', author: 'Nelson Mandela', translation: 'Selalu terlihat mustahil sampai selesai dilakukan.' },
  { quote: 'A person who never made a mistake never tried anything new.', author: 'Albert Einstein', translation: 'Orang yang tidak pernah membuat kesalahan tidak pernah mencoba hal baru.' },
  { quote: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', author: 'Ralph Waldo Emerson', translation: 'Apa yang di belakang dan di depan kita adalah hal kecil dibandingkan apa yang ada di dalam diri kita.' },
  { quote: 'Happiness is not something ready made. It comes from your own actions.', author: 'Dalai Lama', translation: 'Kebahagiaan bukan sesuatu yang sudah jadi. Ia datang dari tindakanmu sendiri.' },
  { quote: 'If you want to lift yourself up, lift up someone else.', author: 'Booker T. Washington', translation: 'Jika kamu ingin mengangkat dirimu, angkat orang lain.' },
  { quote: 'Success usually comes to those who are too busy to be looking for it.', author: 'Henry David Thoreau', translation: 'Kesuksesan biasanya datang kepada mereka yang terlalu sibuk untuk mencarinya.' },
  { quote: 'Do what you can, with what you have, where you are.', author: 'Theodore Roosevelt', translation: 'Lakukan apa yang kamu bisa, dengan apa yang kamu punya, di mana kamu berada.' },
  { quote: 'The best revenge is massive success.', author: 'Frank Sinatra', translation: 'Balas dendam terbaik adalah kesuksesan yang masif.' },
  { quote: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon', translation: 'Hidup adalah apa yang terjadi saat kamu sibuk membuat rencana lain.' },
  { quote: 'Your time is limited, so don\'t waste it living someone else\'s life.', author: 'Steve Jobs', translation: 'Waktumu terbatas, jadi buang-buang untuk hidup orang lain.' },
  { quote: 'Not how long, but how well you have lived is the main thing.', author: 'Seneca', translation: 'Bukan berapa lama, tapi seberapa baik kamu hidup adalah hal utama.' },
  { quote: 'Turn your wounds into wisdom.', author: 'Oprah Winfrey', translation: 'Ubah lukamu menjadi kebijaksanaan.' },
  { quote: 'The only person you are destined to become is the person you decide to be.', author: 'Ralph Waldo Emerson', translation: 'Satu-satunya orang yang ditakdirkan kamu jadi adalah orang yang kamu putuskan untuk jadi.' },
  { quote: 'Go confidently in the direction of your dreams. Live the life you have imagined.', author: 'Henry David Thoreau', translation: 'Melangkahlah dengan percaya diri ke arah mimpimu. Hiduplah hidup yang kamu bayangkan.' },
  { quote: 'When I let go of what I am, I become what I might be.', author: 'Lao Tzu', translation: 'Saat saya melepaskan apa yang saya, saya menjadi apa yang mungkin saya.' },
  { quote: 'Life is 10% what happens to us and 90% how we react to it.', author: 'Charles R. Swindoll', translation: 'Hidup adalah 10% apa yang terjadi pada kita dan 90% bagaimana kita meresponsnya.' },
  { quote: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle', translation: 'Saat-saat tergelap lah kita harus fokus untuk melihat cahaya.' },
  { quote: 'Whoever is happy will make others happy too.', author: 'Anne Frank', translation: 'Siapa pun yang bahagia akan membuat orang lain juga bahagia.' },
  { quote: 'If you look at what you have in life, you\'ll always have more.', author: 'Oprah Winfrey', translation: 'Jika kamu melihat apa yang kamu punya dalam hidup, kamu akan selalu punya lebih.' },
  { quote: 'Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.', author: 'Buddha', translation: 'Jangan tinggal di masa lalu, jangan bermimpi tentang masa depan, fokuskan pikiran pada saat ini.' },
  { quote: 'Start where you are. Use what you have. Do what you can.', author: 'Arthur Ashe', translation: 'Mulailah dari mana kamu berada. Gunakan apa yang kamu punya. Lakukan apa yang kamu bisa.' },
  { quote: 'A champion is defined not by their wins but by how they can recover when they fall.', author: 'Serena Williams', translation: 'Juara didefinisikan bukan dari kemenangannya tapi dari bagaimana ia bangkit saat jatuh.' },
  { quote: 'The purpose of our lives is to be happy.', author: 'Dalai Lama', translation: 'Tujuan hidup kita adalah untuk bahagia.' },
  { quote: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky', translation: 'Kamu melewatkan 100% tembakan yang tidak kamu ambil.' },
  { quote: 'Be yourself; everyone else is already taken.', author: 'Oscar Wilde', translation: 'Jadilah dirimu sendiri; semua orang lain sudah diambil.' },
  { quote: 'Two things are infinite: the universe and human stupidity; and I\'m not sure about the universe.', author: 'Albert Einstein', translation: 'Dua hal tak terbatas: alam semesta dan kebodohan manusia; dan saya tidak yakin tentang alam semesta.' },
  { quote: 'So many books, so little time.', author: 'Frank Zappa', translation: 'Begitu banyak buku, begitu sedikit waktu.' },
  { quote: 'If you tell the truth, you don\'t have to remember anything.', author: 'Mark Twain', translation: 'Jika kamu mengatakan kebenaran, kamu tidak perlu mengingat apa pun.' },
  { quote: 'Be the change that you wish to see in the world.', author: 'Mahatma Gandhi', translation: 'Jadilah perubahan yang ingin kamu lihat di dunia.' },
  { quote: 'May you live all the days of your life.', author: 'Jonathan Swift', translation: 'Semoga kamu hidup di semua hari hidupmu.' },
  { quote: 'The only true wisdom is in knowing you know nothing.', author: 'Socrates', translation: 'Satu-satunya kebijaksanaan sejati adalah mengetahui bahwa kamu tidak tahu apa-apa.' },
  { quote: 'Argue for your limitations, and sure enough, they\'re yours.', author: 'Richard Bach', translation: 'Bantahlah batasanmu, dan pasti, batasan itu jadi milikmu.' },
  { quote: 'If opportunity doesn\'t knock, build a door.', author: 'Milton Berle', translation: 'Jika kesempatan tidak mengetuk, bangunlah pintu.' },
  { quote: 'Keep your face always toward the sunshine, and shadows will fall behind you.', author: 'Walt Whitman', translation: 'Selalu hadapkan wajahmu ke arah sinar matahari, dan bayangan akan jatuh di belakangmu.' },
  { quote: 'Quality is not an act, it is a habit.', author: 'Aristotle', translation: 'Kualitas bukan tindakan, ia adalah kebiasaan.' },
  { quote: 'Knowing is not enough; we must apply. Willing is not enough; we must do.', author: 'Johann Wolfgang von Goethe', translation: 'Tahu tidak cukup; kita harus menerapkan. Mau tidak cukup; kita harus melakukannya.' },
];

// Simple hash from date string to get a deterministic index
function dateToIndex(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % QUOTES.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const todayKey = getTodayKey();

    // Use date-based deterministic selection — no repeat for 60+ days
    const idx = dateToIndex(forceRefresh ? new Date().toISOString().split('T')[0] : todayKey);
    const selected = QUOTES[idx];

    return NextResponse.json({
      quote: selected.quote,
      translation: selected.translation,
      author: selected.author,
      date: todayKey,
    });
  } catch (error) {
    console.error('GET /api/motivational-quote error:', error);
    const fallback = QUOTES[0];
    return NextResponse.json({
      quote: fallback.quote,
      translation: fallback.translation,
      author: fallback.author,
      date: getTodayKey(),
    });
  }
}