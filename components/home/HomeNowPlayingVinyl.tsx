"use client";

import Link from "next/link";
import { VinylRecord } from "@/components/music/VinylRecord";
import { usePlayback } from "@/components/music/PlaybackProvider";
import { getPlaybackTrack } from "@/data/playbackCatalog";
import { vinylAlbums } from "@/data/records";
import styles from "@/components/home/home-now-playing-vinyl.module.css";

const recommendedAlbum =
  vinylAlbums.find((album) => album.id === "yeezus") ?? vinylAlbums[0];
const recommendedTrack = getPlaybackTrack(recommendedAlbum.id);

export function HomeNowPlayingVinyl() {
  const {
    currentAlbum,
    track,
    hasPlayback,
    isPlaying,
    isPriming,
  } = usePlayback();
  const album = hasPlayback ? currentAlbum : recommendedAlbum;
  const displayedTrack = hasPlayback ? track : recommendedTrack;
  const status = !hasPlayback
    ? "Recommended CC0"
    : isPlaying
      ? "Now playing"
      : isPriming
        ? "Cueing"
        : "Paused";

  return (
    <Link
      href="/music"
      className={styles.nowPlaying}
      aria-label={`${status}: ${displayedTrack.title} by ${displayedTrack.artist}, paired with the ${album.title} sleeve. Open the vinyl player.`}
    >
      <span className={styles.copy} aria-hidden="true">
        <small>{status}</small>
        <strong>{displayedTrack.title}</strong>
        <span>{album.title} sleeve · Open player</span>
      </span>

      <span className={styles.recordFrame}>
        <VinylRecord
          album={album}
          playing={!hasPlayback || isPlaying}
          artworkSizes="128px"
          labelSizes="44px"
          className={styles.record}
          variant="floating"
        />
      </span>
    </Link>
  );
}
