/* =========================================================
   Tunton Luk — Dummy Data
   Ganti / kelola data ini lewat halaman Admin (admin.html).
   Semua data disimpan di localStorage browser, jadi setiap
   perubahan lewat Admin akan langsung tampil di Beranda.
   ========================================================= */

const DEFAULT_HERO = {
  title: "Judul Film Rating Tinggi",
  description:
    "Deskripsi Singkat Film nya | Lorem ipsum balabalblalalblbalblbalblablablablblablablblblablbalblablblbalblbalblbaalal",
  image: "https://picsum.photos/seed/tuntonluk-hero/1600/700",
  ctaLabel: "Tonton Sekarang",
};

const DEFAULT_MOVIES = [
  {
    id: "m1",
    title: "Laugh and Laugh",
    author: "Nezo",
    rating: 8.4,
    poster: "https://picsum.photos/seed/laughandlaugh/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
  {
    id: "m2",
    title: "The Karate",
    author: "Nezo",
    rating: 7.9,
    poster: "https://picsum.photos/seed/thekarate/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
  {
    id: "m3",
    title: "Sadness",
    author: "Nezo",
    rating: 7.2,
    poster: "https://picsum.photos/seed/sadness/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
  {
    id: "m4",
    title: "The Betrayal",
    author: "Nezo",
    rating: 8.1,
    poster: "https://picsum.photos/seed/thebetrayal/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
  {
    id: "m5",
    title: "Cats & Friends",
    author: "Nezo",
    rating: 8.8,
    poster: "https://picsum.photos/seed/catsfriends/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
  {
    id: "m6",
    title: "Cartoon",
    author: "Nezo",
    rating: 8.0,
    poster: "https://picsum.photos/seed/cartoonkid/500/700",
    description:
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla nisi mauris, vestibulum nec fermentum lobortis, mollis nec leo.",
  },
];

/* Kredensial dummy untuk login Admin.
   Ganti sesuai kebutuhan sebelum production. */
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};
