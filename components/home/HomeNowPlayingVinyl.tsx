"use client";

import Image from "next/image";
import Link from "next/link";
import { usePlayback } from "@/components/music/PlaybackProvider";
import { getPlaybackTrack } from "@/data/playbackCatalog";
import { vinylAlbums } from "@/data/records";
import styles from "@/components/home/home-vinyl-widget.module.css";

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
    playIntent,
    playbackState,
    error,
  } = usePlayback();
  const album = hasPlayback ? currentAlbum : recommendedAlbum;
  const displayedTrack = hasPlayback ? track : recommendedTrack;
  const motorRunning =
    !hasPlayback ||
    isPlaying ||
    isPriming ||
    playIntent ||
    playbackState === "buffering" ||
    playbackState === "loading";
  const status = !hasPlayback
    ? "Recommended CC0"
    : error
      ? "Unavailable"
      : isPlaying
        ? "Now playing"
        : isPriming
          ? "Cueing"
          : playbackState === "buffering"
            ? "Buffering"
            : playbackState === "loading" || playIntent
              ? "Starting"
              : playbackState === "ended"
                ? "Finished"
                : "Paused";

  return (
    <Link
      href="/music"
      className={styles.nowPlaying}
      data-motor={motorRunning}
      aria-label={`${status}: ${displayedTrack.title} by ${displayedTrack.artist}, paired with the ${album.title} sleeve. Open the vinyl player.`}
    >
      <span className={styles.deck} aria-hidden="true">
        <span className={styles.record}>
          <Image
            className={styles.albumCover}
            src={album.cover}
            alt=""
            fill
            sizes="36px"
            priority
          />
          <span className={styles.spindle} />
        </span>

        <span className={styles.tonearm}>
          <span className={styles.pivot}>
            <span />
          </span>
          <span className={styles.tonearmArm}>
            <span className={styles.counterweight} />
            <span className={styles.armTube} />
            <span className={styles.cartridge}>
              <span className={styles.stylus} />
            </span>
          </span>
        </span>
      </span>
    </Link>
  );
}
