/* =========================================================
   Tunton Luk — Google Drive helper
   Mengubah link share Google Drive jadi URL embed player,
   dan sebaliknya mengambil File ID dari berbagai format link.
   ========================================================= */

function extractDriveFileId(input) {
  if (!input) return null;
  const trimmed = input.trim();

  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  let match = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Format: https://drive.google.com/open?id=FILE_ID
  match = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Kalau yang ditempel sudah berupa ID mentah (bukan link)
  if (/^[a-zA-Z0-9_-]{15,}$/.test(trimmed)) return trimmed;

  return null;
}

function getDriveEmbedUrl(input) {
  const id = extractDriveFileId(input);
  if (!id) return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}
