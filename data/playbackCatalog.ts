export type PlaybackAlbumId =
  | "college-dropout"
  | "late-registration"
  | "graduation"
  | "808s-heartbreak"
  | "mbdtf"
  | "yeezus"
  | "life-of-pablo"
  | "ye"
  | "kids-see-ghosts"
  | "jesus-is-king"
  | "donda";

export type PlaybackTrack = {
  albumId: PlaybackAlbumId;
  title: string;
  artist: "FreePD · CC0";
  src: string;
};

const previewArtist = "FreePD · CC0" as const;

/**
 * CC0 preview audio paired one-to-one with the visual album collection.
 * The recordings are intentionally identified separately from the artwork's
 * artist so the player never misattributes the preview music.
 */
export const playbackCatalog = {
  "college-dropout": {
    albumId: "college-dropout",
    title: "Backbeat",
    artist: previewArtist,
    src: "/media/audio/backbeat.mp3",
  },
  "late-registration": {
    albumId: "late-registration",
    title: "Arpent",
    artist: previewArtist,
    src: "/media/audio/arpent.mp3",
  },
  graduation: {
    albumId: "graduation",
    title: "Fireworks",
    artist: previewArtist,
    src: "/media/audio/fireworks.mp3",
  },
  "808s-heartbreak": {
    albumId: "808s-heartbreak",
    title: "3 AM West End",
    artist: previewArtist,
    src: "/media/audio/3-am-west-end.mp3",
  },
  mbdtf: {
    albumId: "mbdtf",
    title: "Goodnightmare",
    artist: previewArtist,
    src: "/media/audio/goodnightmare.mp3",
  },
  yeezus: {
    albumId: "yeezus",
    title: "Beat One",
    artist: previewArtist,
    src: "/media/audio/beat-one.mp3",
  },
  "life-of-pablo": {
    albumId: "life-of-pablo",
    title: "Hear What They Say",
    artist: previewArtist,
    src: "/media/audio/hear-what-they-say.mp3",
  },
  ye: {
    albumId: "ye",
    title: "Favorite",
    artist: previewArtist,
    src: "/media/audio/favorite.mp3",
  },
  "kids-see-ghosts": {
    albumId: "kids-see-ghosts",
    title: "Hippety Hop",
    artist: previewArtist,
    src: "/media/audio/hippety-hop.mp3",
  },
  "jesus-is-king": {
    albumId: "jesus-is-king",
    title: "Chronos",
    artist: previewArtist,
    src: "/media/audio/chronos.mp3",
  },
  donda: {
    albumId: "donda",
    title: "Bit Bit Loop",
    artist: previewArtist,
    src: "/media/audio/bit-bit-loop.mp3",
  },
} as const satisfies Record<PlaybackAlbumId, PlaybackTrack>;

export function getPlaybackTrack(albumId: string): PlaybackTrack {
  const track = playbackCatalog[albumId as PlaybackAlbumId];

  if (!track) {
    throw new Error(`No playback track is configured for album "${albumId}".`);
  }

  return track;
}
