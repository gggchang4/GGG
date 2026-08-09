"use client";

import Image from "next/image";
import {
  Check,
  ChevronDown,
  Heart,
  ListMusic,
  MonitorSpeaker,
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type WheelEvent,
} from "react";
import gsap from "gsap";
import { vinylAlbums, type VinylAlbum } from "@/data/records";
import { VinylRecord } from "@/components/music/VinylRecord";
import styles from "@/components/music/music-player.module.css";

type PlayerPhase =
  | "browsing"
  | "extracting"
  | "showcase"
  | "loading"
  | "playing"
  | "switching"
  | "closing"
  | "returning";

type ShelfAxis = "x" | "y";

type GestureState = {
  pointerId: number | null;
  axis: ShelfAxis;
  pitch: number;
  startCoordinate: number;
  lastCoordinate: number;
  lastTime: number;
  velocity: number;
  startPosition: number;
  tapIndex: number | null;
  moved: boolean;
};

type PlaybackSpeed = 33 | 45;

type TonearmGestureState = {
  pointerId: number | null;
  moved: boolean;
  startX: number;
  startY: number;
};

const INITIAL_ALBUM_INDEX = 5;
const TONEARM_HOME_ANGLE = -77;
const TONEARM_PLAY_ANGLE = -66;
const TONEARM_MIN_ANGLE = -79;
const TONEARM_MAX_ANGLE = -20;
const TONEARM_RECORD_THRESHOLD = -72;
const SHELF_CYCLES = [-1, 0, 1] as const;

const shelfInstances = SHELF_CYCLES.flatMap((cycle) =>
  vinylAlbums.map((album, albumIndex) => ({
    album,
    albumIndex,
    cycle,
    key: `${cycle}:${album.id}`,
  })),
);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function getContrastingInk(color: string) {
  const hex = color.replace("#", "");
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

  return luminance > 154 ? "#121414" : "#f8f7f3";
}

function wrapAlbumIndex(index: number) {
  const count = vinylAlbums.length;
  return ((index % count) + count) % count;
}

function getWrappedRelative(index: number, position: number) {
  const count = vinylAlbums.length;
  const half = count / 2;
  return ((index - position + half) % count + count) % count - half;
}

function getNearestVirtualPosition(index: number, currentPosition: number) {
  const wrappedIndex = wrapAlbumIndex(index);
  const cycle = Math.round(
    (currentPosition - wrappedIndex) / vinylAlbums.length,
  );
  return wrappedIndex + cycle * vinylAlbums.length;
}

function getShelfAxis(): ShelfAxis {
  const isWideShelf =
    window.innerWidth >= 720 &&
    window.innerWidth / window.innerHeight >= 1.05;

  return isWideShelf ? "x" : "y";
}

function getEstimatedShelfSize(axis: ShelfAxis) {
  if (axis === "x") {
    return Math.min(window.innerHeight * 0.8, window.innerWidth * 0.64, 860);
  }

  return Math.min(window.innerWidth * 0.68, 320);
}

function getShelfPitch(axis = getShelfAxis(), sleeveSize?: number) {
  const estimatedSize = sleeveSize ?? getEstimatedShelfSize(axis);

  if (axis === "x") {
    return clamp(
      window.innerWidth * 0.092,
      estimatedSize * 0.145,
      estimatedSize * 0.22,
    );
  }

  return clamp(estimatedSize * 0.27, 72, 94);
}

function getShelfRelative(
  index: number,
  position: number,
  axis: ShelfAxis,
) {
  // The wide rack has one true centre slot: its sleeve becomes the vanishing
  // spine. The portrait stack keeps its half-step seam to match the reference.
  const centreOffset = axis === "x" ? 0 : 0.5;
  return getWrappedRelative(index, position + centreOffset);
}

function getShelfRotation(
  relative: number,
  axis: ShelfAxis,
  reducedMotion: boolean,
) {
  // Mirror each plane around the centre. On the wide rack the focused sleeve
  // reaches a precise edge-on 90 degrees, while its neighbours ease back to
  // the readable 80-degree fan without ever turning face-on at the centre.
  const side = relative < 0 ? -1 : 1;

  if (axis === "x") {
    const restingAngle = reducedMotion ? 78 : 80;
    const centreLock = 1 - clamp(Math.abs(relative) / 0.5, 0, 1);
    const angle = restingAngle + (90 - restingAngle) * centreLock;

    return {
      rotationX: 0,
      rotationY: -side * angle,
    };
  }

  return {
    rotationX: side * 88,
    rotationY: 0,
  };
}

function getShelfEntryPose(
  index: number,
  position: number,
  reducedMotion: boolean,
) {
  const axis = getShelfAxis();
  const relative = getShelfRelative(index, position, axis);

  return {
    axis,
    ...getShelfRotation(relative, axis, reducedMotion),
  };
}

function getShowcasePose(size: number) {
  const compact = window.innerWidth < 720;

  return {
    x: compact
      ? -Math.min(window.innerWidth * 0.12, size * 0.14)
      : -Math.min(window.innerWidth * 0.22, size * 0.62),
    y: compact ? -window.innerHeight * 0.025 : 0,
    recordX: compact ? size * 0.43 : size * 0.46,
  };
}

function getPlaybackDuration(album: VinylAlbum | null) {
  if (!album) {
    return 0;
  }

  return 198 + ((album.year + album.title.length * 13) % 87);
}

function formatPlaybackTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function Turntable({
  phase,
  album,
  onEject,
  onPrevious,
  onNext,
  onSelectAlbum,
  motorOn,
  speed,
  tonearmAngle,
  tonearmRaised,
  tonearmDragging,
  onTogglePlayback,
  onToggleSpeed,
  onToggleCue,
  onTonearmPointerDown,
  onTonearmPointerMove,
  onTonearmPointerUp,
  onTonearmKeyDown,
  platterRef,
  deckRecordRef,
  tonearmBaseRef,
  tonearmRef,
  stylusRef,
}: {
  phase: PlayerPhase;
  album: VinylAlbum | null;
  onEject: () => void;
  onPrevious: () => void;
  onNext: (shuffle?: boolean) => void;
  onSelectAlbum: (index: number) => void;
  motorOn: boolean;
  speed: PlaybackSpeed;
  tonearmAngle: number;
  tonearmRaised: boolean;
  tonearmDragging: boolean;
  onTogglePlayback: () => void;
  onToggleSpeed: () => void;
  onToggleCue: () => void;
  onTonearmPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onTonearmKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  platterRef: RefObject<HTMLDivElement | null>;
  deckRecordRef: RefObject<HTMLButtonElement | null>;
  tonearmBaseRef: RefObject<HTMLDivElement | null>;
  tonearmRef: RefObject<HTMLButtonElement | null>;
  stylusRef: RefObject<HTMLSpanElement | null>;
}) {
  const spinDuration = 60 / (speed === 33 ? 33 + 1 / 3 : 45);
  const spinStyle = {
    animationDuration: `${spinDuration}s`,
    animationPlayState: motorOn ? "running" : "paused",
  } as CSSProperties;
  const controlsLocked = phase !== "playing" || !album;
  const isPlaying = phase === "playing" && motorOn && !tonearmRaised;
  const duration = getPlaybackDuration(album);
  const currentAlbumIndex = album
    ? vinylAlbums.findIndex((candidate) => candidate.id === album.id)
    : 0;
  const queueEntries = album
    ? Array.from({ length: Math.min(5, vinylAlbums.length - 1) }, (_, offset) => {
        const index = wrapAlbumIndex(currentAlbumIndex + offset + 1);
        return { album: vinylAlbums[index], index };
      })
    : [];
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [volume, setVolume] = useState(72);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [likedAlbums, setLikedAlbums] = useState<Set<string>>(() => new Set());
  const [queueOpen, setQueueOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [deviceName, setDeviceName] = useState("This browser");
  const lastVolumeRef = useRef(72);
  const liked = album ? likedAlbums.has(album.id) : false;
  const progress = duration > 0 ? (elapsedSeconds / duration) * 100 : 0;
  const nextAlbum = queueEntries[0]?.album ?? null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setElapsedSeconds(0);
      setDeviceOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [album?.id]);

  useEffect(() => {
    if (!isPlaying || duration <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => Math.min(duration, current + 0.25));
    }, 250);

    return () => window.clearInterval(timer);
  }, [duration, isPlaying]);

  useEffect(() => {
    if (!album || duration <= 0 || elapsedSeconds < duration) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setElapsedSeconds(0);
      if (repeatMode !== "one") {
        onNext(shuffleEnabled);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [album, duration, elapsedSeconds, onNext, repeatMode, shuffleEnabled]);

  useEffect(() => {
    if (phase !== "playing") {
      return;
    }

    const handlePlaybackKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        onTogglePlayback();
      } else if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        if (volume > 0) {
          lastVolumeRef.current = volume;
          setVolume(0);
        } else {
          setVolume(lastVolumeRef.current || 72);
        }
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const delta = event.key === "ArrowRight" ? 5 : -5;
        setElapsedSeconds((current) => clamp(current + delta, 0, duration));
      }
    };

    window.addEventListener("keydown", handlePlaybackKey);
    return () => window.removeEventListener("keydown", handlePlaybackKey);
  }, [duration, onTogglePlayback, phase, volume]);

  const toggleLike = () => {
    if (!album) {
      return;
    }

    setLikedAlbums((current) => {
      const next = new Set(current);
      if (next.has(album.id)) {
        next.delete(album.id);
      } else {
        next.add(album.id);
      }
      return next;
    });
  };

  const cycleRepeat = () => {
    setRepeatMode((current) =>
      current === "off" ? "all" : current === "all" ? "one" : "off",
    );
  };

  const toggleMute = () => {
    if (volume > 0) {
      lastVolumeRef.current = volume;
      setVolume(0);
    } else {
      setVolume(lastVolumeRef.current || 72);
    }
  };

  const progressStyle = {
    "--range-progress": `${progress}%`,
  } as CSSProperties;
  const volumeStyle = {
    "--range-progress": `${volume}%`,
  } as CSSProperties;

  return (
    <section
      className={styles.turntableScene}
      aria-label="Now playing"
      aria-busy={
        phase === "loading" || phase === "switching" || phase === "returning"
      }
      data-motor={motorOn ? "on" : "off"}
    >
      <div className={styles.turntableShadow} aria-hidden="true" />

      <div className={styles.deck}>
        <div className={styles.deckGrain} aria-hidden="true" />
        <span className={styles.deckMark} aria-hidden="true">
          DIRECT DRIVE
        </span>

        <div ref={platterRef} className={styles.platter}>
          <span className={styles.platterRim} aria-hidden="true" />
          <span
            className={`${styles.platterStrobe} ${styles.isSpinning}`}
            style={spinStyle}
            aria-hidden="true"
          />
          <span className={styles.platterMat} aria-hidden="true" />

          <button
            ref={deckRecordRef}
            type="button"
            className={styles.deckRecord}
            onClick={onTogglePlayback}
            disabled={phase !== "playing"}
            aria-label={
              album
                ? `${isPlaying ? "Pause" : "Play"} ${album.title}`
                : "Record platter"
            }
          >
            {album ? (
              <VinylRecord
                album={album}
                playing={motorOn}
                spinDuration={spinDuration}
                className={styles.deckVinyl}
                variant="platter"
              />
            ) : null}
          </button>

          <span className={styles.spindle} aria-hidden="true" />
        </div>

        <div ref={tonearmBaseRef} className={styles.tonearmBase}>
          <span className={styles.tonearmBaseRing} aria-hidden="true" />
          <button
            ref={tonearmRef}
            type="button"
            className={styles.tonearm}
            data-dragging={tonearmDragging}
            data-raised={tonearmRaised}
            disabled={!album || phase !== "playing"}
            role="slider"
            aria-label="Tonearm position"
            aria-valuemin={TONEARM_HOME_ANGLE}
            aria-valuemax={TONEARM_MAX_ANGLE}
            aria-valuenow={Math.round(tonearmAngle)}
            aria-valuetext={
              tonearmAngle < TONEARM_RECORD_THRESHOLD
                ? "On arm rest"
                : "Over the record"
            }
            onPointerDown={onTonearmPointerDown}
            onPointerMove={onTonearmPointerMove}
            onPointerUp={onTonearmPointerUp}
            onPointerCancel={onTonearmPointerUp}
            onKeyDown={onTonearmKeyDown}
          >
            <span className={styles.counterweight} aria-hidden="true" />
            <svg
              className={styles.armTube}
              viewBox="0 0 360 74"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M18 37 C 96 37, 137 58, 206 48 S 284 20, 333 37" />
              <path d="M20 34 C 97 34, 138 55, 205 45 S 282 17, 332 34" />
            </svg>
            <span ref={stylusRef} className={styles.stylus} aria-hidden="true">
              <span />
            </span>
          </button>

          <button
            type="button"
            className={styles.cueLever}
            onClick={onToggleCue}
            disabled={!album || phase !== "playing"}
            aria-label={tonearmRaised ? "Lower tonearm" : "Raise tonearm"}
            aria-pressed={tonearmRaised}
          >
            <span aria-hidden="true" />
          </button>
        </div>

        <span className={styles.stylusLamp} aria-hidden="true" />

        {album ? (
          <div
            className={styles.playerChrome}
            data-playing={isPlaying}
            data-queue-open={queueOpen}
          >
            <header className={styles.nowPlayingHeader}>
              <button
                type="button"
                className={styles.headerAction}
                onClick={onEject}
                disabled={phase !== "playing"}
                aria-label="Return to album shelf"
              >
                <ChevronDown aria-hidden="true" />
              </button>
              <div className={styles.headerStatus}>
                <span className={styles.statusPulse} aria-hidden="true" />
                <span>
                  {phase === "switching"
                    ? "Changing record"
                    : isPlaying
                      ? "Now playing"
                      : "Playback paused"}
                </span>
              </div>
              <button
                type="button"
                className={styles.headerAction}
                onClick={() => setQueueOpen((open) => !open)}
                aria-label={queueOpen ? "Close play queue" : "Open play queue"}
                aria-expanded={queueOpen}
              >
                <ListMusic aria-hidden="true" />
              </button>
            </header>

            <section
              className={styles.playerContext}
              aria-labelledby="now-playing-title"
            >
              <div className={styles.contextArtwork} aria-hidden="true">
                <Image
                  src={album.cover}
                  alt=""
                  fill
                  sizes="96px"
                  draggable={false}
                />
              </div>
              <div className={styles.contextCopy}>
                <div className={styles.contextEyebrow}>
                  <span>{isPlaying ? "Playing from album" : "Paused"}</span>
                  <span className={styles.qualityBadge}>Vinyl mode</span>
                </div>
                <h1 id="now-playing-title" className={styles.contextTitle}>
                  {album.title}
                </h1>
                <p className={styles.contextArtist}>{album.artist}</p>
                <p className={styles.contextMeta}>
                  {album.year} <span aria-hidden="true">&bull;</span>{" "}
                  {speed === 33 ? "33⅓" : "45"} RPM
                </p>
              </div>
              <div className={styles.contextActionRow}>
                <button
                  type="button"
                  className={styles.likeLarge}
                  data-active={liked}
                  onClick={toggleLike}
                  aria-label={liked ? "Remove from liked music" : "Save to liked music"}
                  aria-pressed={liked}
                >
                  {liked ? <Check aria-hidden="true" /> : <Heart aria-hidden="true" />}
                  <span>{liked ? "Saved" : "Save"}</span>
                </button>
                {nextAlbum ? (
                  <button
                    type="button"
                    className={styles.upNextButton}
                    onClick={() => setQueueOpen(true)}
                    aria-label={`Open queue. Up next: ${nextAlbum.title}`}
                  >
                    <span className={styles.upNextArtwork} aria-hidden="true">
                      <Image
                        src={nextAlbum.cover}
                        alt=""
                        fill
                        sizes="48px"
                        draggable={false}
                      />
                    </span>
                    <span className={styles.upNextText}>
                      <small>Up next</small>
                      <strong>{nextAlbum.title}</strong>
                    </span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </section>

            <footer className={styles.playerBar}>
              <div className={styles.barTrack}>
                <span className={styles.barArtwork} aria-hidden="true">
                  <Image
                    src={album.cover}
                    alt=""
                    fill
                    sizes="56px"
                    draggable={false}
                  />
                </span>
                <span className={styles.barIdentity}>
                  <strong>{album.title}</strong>
                  <span>{album.artist}</span>
                </span>
                <button
                  type="button"
                  className={styles.iconButton}
                  data-active={liked}
                  onClick={toggleLike}
                  aria-label={liked ? "Remove from liked music" : "Save to liked music"}
                  aria-pressed={liked}
                >
                  <Heart fill={liked ? "currentColor" : "none"} aria-hidden="true" />
                </button>
              </div>

              <div className={styles.barCenter}>
                <div className={styles.transportControls} role="group" aria-label="Playback controls">
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={shuffleEnabled}
                    onClick={() => setShuffleEnabled((enabled) => !enabled)}
                    disabled={controlsLocked}
                    aria-label={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
                    aria-pressed={shuffleEnabled}
                  >
                    <Shuffle aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={onPrevious}
                    disabled={controlsLocked}
                    aria-label="Previous album"
                  >
                    <SkipBack fill="currentColor" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.playButton}
                    onClick={onTogglePlayback}
                    disabled={controlsLocked}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    aria-keyshortcuts="Space"
                  >
                    {isPlaying ? (
                      <Pause fill="currentColor" aria-hidden="true" />
                    ) : (
                      <Play fill="currentColor" aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => onNext(shuffleEnabled)}
                    disabled={controlsLocked}
                    aria-label="Next album"
                  >
                    <SkipForward fill="currentColor" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={repeatMode !== "off"}
                    data-repeat={repeatMode}
                    onClick={cycleRepeat}
                    disabled={controlsLocked}
                    aria-label={`Repeat ${repeatMode}`}
                    aria-pressed={repeatMode !== "off"}
                  >
                    <Repeat2 aria-hidden="true" />
                    {repeatMode === "one" ? <small aria-hidden="true">1</small> : null}
                  </button>
                </div>
                <div className={styles.timeline}>
                  <time>{formatPlaybackTime(elapsedSeconds)}</time>
                  <input
                    type="range"
                    className={styles.playerSeek}
                    min="0"
                    max={duration}
                    step="0.25"
                    value={Math.min(elapsedSeconds, duration)}
                    style={progressStyle}
                    onInput={(event) => setElapsedSeconds(Number(event.currentTarget.value))}
                    disabled={controlsLocked}
                    aria-label="Playback position"
                    aria-valuetext={`${formatPlaybackTime(elapsedSeconds)} of ${formatPlaybackTime(duration)}`}
                  />
                  <time>{formatPlaybackTime(duration)}</time>
                </div>
              </div>

              <div className={styles.barUtility}>
                <button
                  type="button"
                  className={styles.speedButton}
                  onClick={onToggleSpeed}
                  disabled={controlsLocked}
                  aria-label={`Change playback speed. Current setting ${speed === 33 ? "33 and one third" : "45"} RPM`}
                >
                  {speed === 33 ? "33⅓" : "45"}
                </button>
                <button
                  type="button"
                  className={styles.iconButton}
                  data-active={queueOpen}
                  onClick={() => setQueueOpen((open) => !open)}
                  aria-label={queueOpen ? "Close queue" : "Open queue"}
                  aria-expanded={queueOpen}
                >
                  <ListMusic aria-hidden="true" />
                </button>
                <div className={styles.deviceMenu}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    data-active={deviceOpen}
                    onClick={() => setDeviceOpen((open) => !open)}
                    aria-label={`Listening on ${deviceName}`}
                    aria-expanded={deviceOpen}
                  >
                    <MonitorSpeaker aria-hidden="true" />
                  </button>
                  {deviceOpen ? (
                    <div className={styles.devicePopover} role="dialog" aria-label="Connect to a device">
                      <strong>Connect to a device</strong>
                      {["This browser", "Studio speakers"].map((device) => (
                        <button
                          key={device}
                          type="button"
                          className={styles.deviceOption}
                          data-active={deviceName === device}
                          onClick={() => {
                            setDeviceName(device);
                            setDeviceOpen(false);
                          }}
                        >
                          <MonitorSpeaker aria-hidden="true" />
                          <span>
                            <strong>{device}</strong>
                            <small>{device === "This browser" ? "Web Player" : "Available"}</small>
                          </span>
                          {deviceName === device ? <Check aria-hidden="true" /> : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className={styles.volumeControl}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={toggleMute}
                    aria-label={volume > 0 ? "Mute" : "Unmute"}
                    aria-keyshortcuts="M"
                  >
                    {volume > 0 ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
                  </button>
                  <input
                    type="range"
                    className={styles.volumeSlider}
                    min="0"
                    max="100"
                    value={volume}
                    style={volumeStyle}
                    onInput={(event) => setVolume(Number(event.currentTarget.value))}
                    aria-label="Volume"
                    aria-valuetext={`${volume} percent`}
                  />
                </div>
              </div>
            </footer>

            {queueOpen ? (
              <aside className={styles.queueDrawer} aria-label="Play queue">
                <div className={styles.queueHeader}>
                  <div>
                    <small>Playing next</small>
                    <strong>Queue</strong>
                  </div>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => setQueueOpen(false)}
                    aria-label="Close queue panel"
                  >
                    <X aria-hidden="true" />
                  </button>
                </div>
                <span className={styles.queueSectionLabel}>Now playing</span>
                <div className={styles.queueCurrent}>
                  <span className={styles.queueArtwork} aria-hidden="true">
                    <Image src={album.cover} alt="" fill sizes="52px" draggable={false} />
                  </span>
                  <span className={styles.queueCopy}>
                    <strong>{album.title}</strong>
                    <span>{album.artist}</span>
                  </span>
                  <span
                    className={styles.playingBars}
                    data-playing={isPlaying}
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                  </span>
                </div>
                <span className={styles.queueSectionLabel}>Next in queue</span>
                <div className={styles.queueList}>
                  {queueEntries.map((entry, queueIndex) => (
                    <button
                      key={entry.album.id}
                      type="button"
                      className={styles.queueItem}
                      onClick={() => {
                        onSelectAlbum(entry.index);
                        setQueueOpen(false);
                      }}
                    >
                      <span className={styles.queuePosition}>{queueIndex + 1}</span>
                      <span className={styles.queueArtwork} aria-hidden="true">
                        <Image src={entry.album.cover} alt="" fill sizes="48px" draggable={false} />
                      </span>
                      <span className={styles.queueCopy}>
                        <strong>{entry.album.title}</strong>
                        <span>{entry.album.artist} · {entry.album.year}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function MusicPlayerExperience() {
  const rootRef = useRef<HTMLElement>(null);
  const rackRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const shelfItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const sleeveRef = useRef<HTMLButtonElement>(null);
  const floatingRecordRef = useRef<HTMLButtonElement>(null);
  const platterRef = useRef<HTMLDivElement>(null);
  const deckRecordRef = useRef<HTMLButtonElement>(null);
  const tonearmBaseRef = useRef<HTMLDivElement>(null);
  const tonearmRef = useRef<HTMLButtonElement>(null);
  const stylusRef = useRef<HTMLSpanElement>(null);
  const sequenceRef = useRef<gsap.core.Timeline | null>(null);
  const shelfTweenRef = useRef<gsap.core.Tween | null>(null);
  const positionRef = useRef({ value: INITIAL_ALBUM_INDEX });
  const removedIndexRef = useRef<number | null>(null);
  const gapProgressRef = useRef({ value: 0 });
  const phaseRef = useRef<PlayerPhase>("browsing");
  const gestureRef = useRef<GestureState>({
    pointerId: null,
    axis: "y",
    pitch: 82,
    startCoordinate: 0,
    lastCoordinate: 0,
    lastTime: 0,
    velocity: 0,
    startPosition: INITIAL_ALBUM_INDEX,
    tapIndex: null,
    moved: false,
  });
  const tonearmGestureRef = useRef<TonearmGestureState>({
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
  });
  const tonearmAngleRef = useRef(TONEARM_HOME_ANGLE);
  const wheelSnapRef = useRef<number | null>(null);

  const [phase, setPhaseState] = useState<PlayerPhase>("browsing");
  const [activeIndex, setActiveIndex] = useState(INITIAL_ALBUM_INDEX);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedIndex, setLoadedIndex] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motorOn, setMotorOn] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(33);
  const [tonearmAngle, setTonearmAngle] = useState(TONEARM_HOME_ANGLE);
  const [tonearmRaised, setTonearmRaised] = useState(true);
  const [tonearmDragging, setTonearmDragging] = useState(false);

  const selectedAlbum =
    selectedIndex === null ? null : vinylAlbums[selectedIndex];
  const loadedAlbum = loadedIndex === null ? null : vinylAlbums[loadedIndex];

  const updatePhase = useCallback((nextPhase: PlayerPhase) => {
    phaseRef.current = nextPhase;
    setPhaseState(nextPhase);
  }, []);

  const layoutShelf = useCallback(() => {
    const position = positionRef.current.value;
    const axis = getShelfAxis();
    const removedIndex = removedIndexRef.current;
    const gapProgress = gapProgressRef.current.value;

    if (rackRef.current) {
      rackRef.current.dataset.orientation =
        axis === "x" ? "horizontal" : "vertical";
    }
    if (rootRef.current) {
      rootRef.current.dataset.browseAxis = axis;
    }

    const referenceSlot = slotRefs.current.find(
      (slot): slot is HTMLButtonElement => Boolean(slot),
    );
    const sleeveSize = referenceSlot?.offsetWidth ?? 320;
    const pitch = getShelfPitch(axis, sleeveSize);
    const velocityTilt = clamp(
      gestureRef.current.velocity / 2400,
      -1,
      1,
    ) * (axis === "x" ? 3 : 1.2);

    const visibleRadius =
      (axis === "x" ? window.innerWidth : window.innerHeight) / (pitch * 2) +
      (axis === "x" ? 1.35 : 1.6);

    shelfItemRefs.current.forEach((slot) => {
      if (!slot) {
        return;
      }

      const albumIndex = Number(slot.dataset.recordIndex);
      const cycle = Number(slot.dataset.shelfCycle);

      if (albumIndex === removedIndex && cycle === 0) {
        return;
      }

      const wrappedRelative =
        getShelfRelative(albumIndex, position, axis) +
        cycle * vinylAlbums.length;
      const removalSide =
        removedIndex === null
          ? 0
          : getShelfRelative(albumIndex, removedIndex, axis) +
            cycle * vinylAlbums.length;
      const relative =
        wrappedRelative +
        (removalSide < 0
          ? -gapProgress * 0.34
          : removalSide > 0
            ? gapProgress * 0.34
            : 0);
      const distance = Math.abs(relative);
      const focus = 1 - clamp(distance, 0, 1);
      const veil = clamp((distance - 1) * 0.045, 0, 0.22);
      const depthBlur =
        axis === "x"
          ? clamp((distance - 3.75) * 3.2, 0, 6)
          : relative > 2.2
            ? clamp((relative - 2.2) * 4.2, 0, 12)
            : relative < -3.25
              ? clamp((-relative - 3.25) * 1.9, 0, 4.5)
              : 0;
      const rotation = getShelfRotation(relative, axis, reducedMotion);
      const centreVelocityLock =
        axis === "x" ? clamp(distance / 0.5, 0, 1) : 1;
      const slotRotationX =
        axis === "y" ? rotation.rotationX + velocityTilt : 0;
      const slotRotationY =
        axis === "x"
          ? rotation.rotationY + velocityTilt * centreVelocityLock
          : 0;
      const sleeve = slot.querySelector<HTMLElement>("[data-shelf-sleeve]");

      slot.dataset.stackSide = relative < -0.08
        ? "above"
        : relative > 0.08
          ? "below"
          : "focus";
      slot.style.setProperty("--shelf-veil", veil.toFixed(3));
      slot.style.setProperty("--face-blur", `${depthBlur.toFixed(2)}px`);
      slot.style.setProperty(
        "--face-brightness",
        `${clamp(
          (axis === "x" ? 1.035 : 1.025) -
            distance * (axis === "x" ? 0.025 : 0.034),
          axis === "x" ? 0.86 : 0.81,
          1.035,
        ).toFixed(3)}`,
      );

      const visible = distance <= visibleRadius;

      gsap.set(
        slot,
        axis === "x"
          ? {
              x: relative * pitch,
              y: 0,
              z: -distance * sleeveSize * 0.012 + focus * sleeveSize * 0.018,
              rotationX: 0,
              rotationY: slotRotationY,
              rotationZ: 0,
              scale: 1,
              zIndex: Math.round(200 - distance * 12),
              autoAlpha: visible ? 1 : 0,
              visibility: visible ? "visible" : "hidden",
              filter: "none",
            }
          : {
              x:
                Math.sin(albumIndex * 1.73) *
                Math.min(4, sleeveSize * 0.012),
              y: relative * pitch,
              z:
                clamp(relative, -5.2, 3.2) * sleeveSize * 0.04 +
                focus * sleeveSize * 0.045,
              rotationX: slotRotationX,
              rotationY: 0,
              rotationZ: reducedMotion
                ? 0
                : Math.sin(albumIndex * 2.17) * 0.7,
              scale: 1,
              zIndex: Math.round(100 + relative * 10),
              autoAlpha: visible ? 1 : 0,
              visibility: visible ? "visible" : "hidden",
              filter: "none",
            },
      );

      if (sleeve) {
        gsap.set(sleeve, {
          z: 0,
        });
      }
    });
  }, [reducedMotion]);

  const animateShelfTo = useCallback(
    (index: number, onComplete?: () => void) => {
      const target = getNearestVirtualPosition(
        index,
        positionRef.current.value,
      );
      const distance = Math.abs(positionRef.current.value - target);

      shelfTweenRef.current?.kill();
      shelfTweenRef.current = gsap.to(positionRef.current, {
        value: target,
        duration: reducedMotion ? 0.12 : clamp(0.3 + distance * 0.08, 0.34, 0.66),
        ease: reducedMotion ? "power1.out" : "expo.out",
        overwrite: true,
        onUpdate: () => {
          gestureRef.current.velocity *= 0.82;
          layoutShelf();
        },
        onComplete: () => {
          gestureRef.current.velocity = 0;
          positionRef.current.value = wrapAlbumIndex(target);
          layoutShelf();
          onComplete?.();
        },
      });
    },
    [layoutShelf, reducedMotion],
  );

  const focusAlbum = useCallback(
    (index: number, extract = false) => {
      if (phaseRef.current !== "browsing") {
        return;
      }

      const target = wrapAlbumIndex(index);
      const virtualTarget = getNearestVirtualPosition(
        target,
        positionRef.current.value,
      );
      setActiveIndex(target);

      const beginExtraction = () => {
        if (!extract || phaseRef.current !== "browsing") {
          return;
        }

        setSelectedIndex(target);
        updatePhase("extracting");
      };

      if (Math.abs(positionRef.current.value - virtualTarget) < 0.025) {
        positionRef.current.value = target;
        layoutShelf();
        beginExtraction();
        return;
      }

      animateShelfTo(target, () => {
        beginExtraction();
      });
    },
    [animateShelfTo, layoutShelf, updatePhase],
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setReducedMotion(preference.matches);

    updatePreference();
    preference.addEventListener("change", updatePreference);

    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useLayoutEffect(() => {
    layoutShelf();

    const onResize = () => layoutShelf();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, [layoutShelf]);

  useLayoutEffect(() => {
    if (!rootRef.current) {
      return;
    }

    const context = gsap.context(() => {
      const duration = reducedMotion ? 0.01 : 1;
      const visibleSlots = shelfItemRefs.current.filter(
        (slot): slot is HTMLButtonElement =>
          slot !== null && slot.style.visibility !== "hidden",
      );

      gsap.set("[data-turntable]", { autoAlpha: 0, scale: 0.96 });

      gsap
        .timeline({
          defaults: { ease: "power3.out" },
          onComplete: layoutShelf,
        })
        .fromTo(
          "[data-rack]",
          { autoAlpha: 0, scale: 1.035 },
          { autoAlpha: 1, scale: 1, duration: duration * 0.95 },
          0,
        )
        .fromTo(
          visibleSlots,
          { autoAlpha: 0 },
          {
            autoAlpha: 1,
            duration: duration * 0.48,
            stagger: reducedMotion ? 0 : 0.012,
          },
          duration * 0.16,
        );
    }, rootRef);

    return () => context.revert();
  }, [layoutShelf, reducedMotion]);

  const restoreShelfAlbum = useCallback(
    (index: number) => {
      removedIndexRef.current = null;
      gapProgressRef.current.value = 0;

      const slot = slotRefs.current[index];
      if (slot) {
        gsap.set(slot, { visibility: "visible" });
      }

      layoutShelf();
    },
    [layoutShelf],
  );

  useLayoutEffect(() => {
    if (
      phase !== "extracting" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];
    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const size = sleeveBounds.width;
    const pose = getShowcasePose(size);
    const startX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const startY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const startScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(size, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.82;

    removedIndexRef.current = selectedIndex;
    gapProgressRef.current.value = 0;

    sequenceRef.current?.kill();
    gsap.set(sleeve, {
      x: startX,
      y: startY,
      scale: startScale,
      rotationX: shelfPose.rotationX,
      rotationY: shelfPose.rotationY,
      rotationZ: 0,
      autoAlpha: reducedMotion ? 0 : 1,
    });
    gsap.set(record, {
      x: startX,
      y: startY,
      scale: startScale * 0.96,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      transformPerspective: 900,
      transformOrigin: "50% 50%",
      autoAlpha: 0,
    });

    const sequence = gsap.timeline({
      onComplete: () => updatePhase("showcase"),
    });
    sequenceRef.current = sequence;

    if (selectedSlot) {
      sequence
        .to(
          selectedSlot,
          {
            z: "+=34",
            scale: "*=0.992",
            duration: reducedMotion ? 0.01 : 0.08,
            ease: "power2.out",
          },
          0,
        )
        .to(
          selectedSlot,
          {
            z: "+=58",
            autoAlpha: 0,
            duration: reducedMotion ? 0.08 : 0.14,
            ease: "power2.out",
          },
          reducedMotion ? 0 : 0.06,
        );
    }

    sequence.to(
      gapProgressRef.current,
      {
        value: 1,
        duration: reducedMotion ? 0.08 : duration * 0.54,
        ease: "power3.inOut",
        onUpdate: layoutShelf,
      },
      reducedMotion ? 0 : 0.16,
    );

    sequence
      .to(
        rackRef.current,
        {
          opacity: 0.38,
          y: reducedMotion ? 0 : 10,
          duration: duration * 0.58,
          ease: "power2.out",
        },
        0.08 * duration,
      )
      .to(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 1,
          rotationX: 0,
          rotationY: reducedMotion ? 0 : -1.4,
          rotationZ: reducedMotion ? 0 : -2.8,
          autoAlpha: 1,
          duration,
          ease: reducedMotion ? "power1.out" : "expo.out",
        },
        0.12 * duration,
      )
      .set(
        record,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.955,
          rotationX: reducedMotion ? 0 : 2,
          rotationY: 0,
          autoAlpha: 1,
        },
        0.46 * duration,
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          scale: 0.985,
          rotationX: 0,
          rotationZ: reducedMotion ? 0 : 2.4,
          duration: duration * 0.48,
          ease: reducedMotion ? "power1.out" : "expo.out",
        },
        0.54 * duration,
      );

    return () => {
      if (sequenceRef.current === sequence && sequence.isActive()) {
        sequence.kill();
      }
    };
  }, [layoutShelf, phase, reducedMotion, selectedIndex, updatePhase]);

  useEffect(() => {
    return () => {
      sequenceRef.current?.kill();
      shelfTweenRef.current?.kill();
      if (wheelSnapRef.current !== null) {
        window.clearTimeout(wheelSnapRef.current);
      }
    };
  }, []);

  const handleRackPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (
      phaseRef.current !== "browsing" ||
      event.button !== 0 ||
      gestureRef.current.pointerId !== null
    ) {
      return;
    }

    shelfTweenRef.current?.kill();
    const pressedSlot = (event.target as Element).closest<HTMLElement>(
      "[data-record-index]",
    );
    const pressedIndex = Number(pressedSlot?.dataset.recordIndex);

    const now = performance.now();
    const axis = getShelfAxis();
    const referenceSize =
      slotRefs.current.find((slot) => Boolean(slot))?.offsetWidth;
    const coordinate = axis === "x" ? event.clientX : event.clientY;

    gestureRef.current = {
      pointerId: event.pointerId,
      axis,
      pitch: getShelfPitch(axis, referenceSize),
      startCoordinate: coordinate,
      lastCoordinate: coordinate,
      lastTime: now,
      velocity: 0,
      startPosition: positionRef.current.value,
      tapIndex: Number.isFinite(pressedIndex) ? pressedIndex : null,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleRackPointerMove = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (
      phaseRef.current !== "browsing" ||
      gesture.pointerId !== event.pointerId
    ) {
      return;
    }

    const coordinate =
      gesture.axis === "x" ? event.clientX : event.clientY;
    const delta = coordinate - gesture.startCoordinate;
    const now = performance.now();
    const elapsed = Math.max(now - gesture.lastTime, 8);
    const sampledVelocity =
      ((coordinate - gesture.lastCoordinate) / elapsed) * 1000;

    gesture.velocity = gesture.velocity * 0.55 + sampledVelocity * 0.45;
    gesture.lastCoordinate = coordinate;
    gesture.lastTime = now;

    if (!gesture.moved && Math.abs(delta) > 8) {
      gesture.moved = true;
    }

    positionRef.current.value =
      gesture.startPosition - delta / gesture.pitch;
    const nextActive = wrapAlbumIndex(Math.round(positionRef.current.value));

    if (nextActive !== activeIndex) {
      setActiveIndex(nextActive);
    }
    layoutShelf();
  };

  const finishRackGesture = (event: PointerEvent<HTMLElement>) => {
    const gesture = gestureRef.current;

    if (gesture.pointerId !== event.pointerId) {
      return;
    }

    const velocityIndex = -gesture.velocity / gesture.pitch;
    const projectedPosition =
      positionRef.current.value + clamp(velocityIndex * 0.18, -4, 4);
    const snapTarget = wrapAlbumIndex(
      Math.round(
        event.type === "pointercancel"
          ? positionRef.current.value
          : projectedPosition,
      ),
    );
    const tapTarget = gesture.tapIndex ?? activeIndex;
    gestureRef.current.pointerId = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (gesture.moved || event.type === "pointercancel") {
      setActiveIndex(snapTarget);
      animateShelfTo(snapTarget);
    } else {
      focusAlbum(tapTarget, true);
    }
  };

  const handleShelfWheel = (event: WheelEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    const axis = getShelfAxis();
    const rawDelta =
      axis === "x"
        ? Math.abs(event.deltaX) > Math.abs(event.deltaY) * 0.7
          ? event.deltaX
          : event.deltaY
        : event.deltaY;

    const delta =
      event.deltaMode === 1
        ? rawDelta * 16
        : event.deltaMode === 2
          ? rawDelta * (axis === "x" ? window.innerWidth : window.innerHeight)
          : rawDelta;

    if (Math.abs(delta) < 0.5) {
      return;
    }

    event.preventDefault();
    shelfTweenRef.current?.kill();
    const referenceSize =
      slotRefs.current.find((slot) => Boolean(slot))?.offsetWidth;
    const shelfPitch = getShelfPitch(axis, referenceSize);
    gestureRef.current.velocity = clamp(delta * -7, -1500, 1500);
    positionRef.current.value +=
      (clamp(delta, -120, 120) / shelfPitch) * 0.42;

    const nextActive = wrapAlbumIndex(Math.round(positionRef.current.value));
    if (nextActive !== activeIndex) {
      setActiveIndex(nextActive);
    }
    layoutShelf();

    if (wheelSnapRef.current !== null) {
      window.clearTimeout(wheelSnapRef.current);
    }
    wheelSnapRef.current = window.setTimeout(() => {
      wheelSnapRef.current = null;
      const target = wrapAlbumIndex(Math.round(positionRef.current.value));
      setActiveIndex(target);
      animateShelfTo(target);
    }, reducedMotion ? 0 : 90);
  };

  const handleRackKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (phaseRef.current !== "browsing") {
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex - 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = wrapAlbumIndex(activeIndex + 1);
      focusAlbum(nextIndex);
      slotRefs.current[nextIndex]?.focus({ preventScroll: true });
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const focusedSlot = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-record-index]",
      );
      const focusedIndex = Number(focusedSlot?.dataset.recordIndex);
      focusAlbum(Number.isFinite(focusedIndex) ? focusedIndex : activeIndex, true);
    }
  };

  const setTonearmVisual = useCallback(
    (nextAngle: number, animate = false, commit = true) => {
      const angle = clamp(nextAngle, TONEARM_MIN_ANGLE, TONEARM_MAX_ANGLE);

      tonearmAngleRef.current = angle;
      if (commit) {
        setTonearmAngle(angle);
      }

      if (!tonearmRef.current) {
        return;
      }

      if (animate) {
        gsap.to(tonearmRef.current, {
          rotationZ: angle,
          duration: reducedMotion ? 0.12 : 0.42,
          ease: "power2.inOut",
          overwrite: true,
        });
      } else {
        gsap.set(tonearmRef.current, { rotationZ: angle });
      }
    },
    [reducedMotion],
  );

  const setCueRaised = useCallback(
    (raised: boolean, animate = true) => {
      setTonearmRaised(raised);

      if (!stylusRef.current) {
        return;
      }

      if (animate) {
        gsap.to(stylusRef.current, {
          y: raised ? -6 : 0,
          duration: reducedMotion ? 0.08 : 0.22,
          ease: raised ? "power2.out" : "power2.inOut",
          overwrite: true,
        });
      } else {
        gsap.set(stylusRef.current, { y: raised ? -6 : 0 });
      }
    },
    [reducedMotion],
  );

  const togglePlayback = useCallback(() => {
    if (phaseRef.current !== "playing" || loadedIndex === null) {
      return;
    }

    const currentlyPlaying = motorOn && !tonearmRaised;

    if (currentlyPlaying) {
      setMotorOn(false);
      return;
    }

    if (tonearmAngleRef.current < TONEARM_RECORD_THRESHOLD) {
      setTonearmVisual(TONEARM_PLAY_ANGLE, true);
    }
    setCueRaised(false);
    setMotorOn(true);
  }, [loadedIndex, motorOn, setCueRaised, setTonearmVisual, tonearmRaised]);

  const toggleSpeed = useCallback(() => {
    if (phaseRef.current !== "playing") {
      return;
    }

    setSpeed((currentSpeed) => (currentSpeed === 33 ? 45 : 33));
  }, []);

  const toggleCue = useCallback(() => {
    if (phaseRef.current !== "playing" || loadedIndex === null) {
      return;
    }

    const nextRaised = !tonearmRaised;
    setCueRaised(nextRaised);

    if (!nextRaised && tonearmAngleRef.current >= TONEARM_RECORD_THRESHOLD) {
      setMotorOn(true);
    }
  }, [loadedIndex, setCueRaised, tonearmRaised]);

  const getTonearmAngleFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const base = tonearmBaseRef.current?.getBoundingClientRect();

      if (!base) {
        return tonearmAngleRef.current;
      }

      const pivotX = base.left + base.width / 2;
      const pivotY = base.top + base.height / 2;
      const rawAngle =
        (Math.atan2(clientY - pivotY, clientX - pivotX) * 180) / Math.PI;
      const normalizedAngle = rawAngle < 0 ? rawAngle + 360 : rawAngle;

      return clamp(
        normalizedAngle - 180,
        TONEARM_MIN_ANGLE,
        TONEARM_MAX_ANGLE,
      );
    },
    [],
  );

  const handleTonearmPointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      if (
        phaseRef.current !== "playing" ||
        loadedIndex === null ||
        event.button !== 0 ||
        tonearmGestureRef.current.pointerId !== null
      ) {
        return;
      }

      event.preventDefault();
      tonearmGestureRef.current = {
        pointerId: event.pointerId,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setTonearmDragging(true);
    },
    [loadedIndex],
  );

  const handleTonearmPointerMove = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (
        phaseRef.current !== "playing" ||
        gesture.pointerId !== event.pointerId
      ) {
        return;
      }

      const travel = Math.hypot(
        event.clientX - gesture.startX,
        event.clientY - gesture.startY,
      );

      if (!gesture.moved && travel > 4) {
        gesture.moved = true;
        setCueRaised(true);
      }

      if (gesture.moved) {
        setTonearmVisual(
          getTonearmAngleFromPointer(event.clientX, event.clientY),
          false,
          false,
        );
      }
    },
    [getTonearmAngleFromPointer, setCueRaised, setTonearmVisual],
  );

  const finishTonearmGesture = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const gesture = tonearmGestureRef.current;

      if (gesture.pointerId !== event.pointerId) {
        return;
      }

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      tonearmGestureRef.current.pointerId = null;
      setTonearmDragging(false);

      if (event.type === "pointercancel") {
        setTonearmVisual(tonearmAngleRef.current, true);
        return;
      }

      if (!gesture.moved) {
        toggleCue();
        return;
      }

      if (tonearmAngleRef.current < TONEARM_RECORD_THRESHOLD) {
        setTonearmVisual(TONEARM_HOME_ANGLE, true);
        setCueRaised(true);
        setMotorOn(false);
        return;
      }

      setTonearmVisual(tonearmAngleRef.current, true);
      setCueRaised(false);
      setMotorOn(true);
    },
    [setCueRaised, setTonearmVisual, toggleCue],
  );

  const handleTonearmKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      let nextAngle: number | null = null;

      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
        nextAngle = tonearmAngleRef.current + 2;
      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
        nextAngle = tonearmAngleRef.current - 2;
      } else if (event.key === "Home") {
        nextAngle = TONEARM_HOME_ANGLE;
      } else if (event.key === "End") {
        nextAngle = TONEARM_MAX_ANGLE;
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCue();
        return;
      }

      if (nextAngle === null) {
        return;
      }

      event.preventDefault();
      setCueRaised(true);
      const keyboardAngle = clamp(
        nextAngle,
        TONEARM_HOME_ANGLE,
        TONEARM_MAX_ANGLE,
      );
      setTonearmVisual(keyboardAngle, true);

      if (keyboardAngle <= TONEARM_HOME_ANGLE) {
        setMotorOn(false);
      }
    },
    [setCueRaised, setTonearmVisual, toggleCue],
  );

  const placeRecord = useCallback(() => {
    const turntable = rootRef.current?.querySelector<HTMLElement>(
      "[data-turntable]",
    );

    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !stylusRef.current ||
      !rackRef.current ||
      !turntable
    ) {
      return;
    }

    updatePhase("loading");
    setLoadedIndex(selectedIndex);
    setSpeed(vinylAlbums[selectedIndex].vinyl.rpm === 45 ? 45 : 33);
    setMotorOn(false);
    setTonearmRaised(true);
    tonearmAngleRef.current = TONEARM_HOME_ANGLE;
    setTonearmAngle(TONEARM_HOME_ANGLE);

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    // The hidden scene used to be scaled to .96, which made every landing
    // several pixels short. Freeze its final geometry before measuring it.
    gsap.set(turntable, { scale: 1 });
    const deckRecordBounds = deckRecord.getBoundingClientRect();
    const recordBounds = record.getBoundingClientRect();
    const currentScale = Number(gsap.getProperty(record, "scale")) || 1;
    const currentX = Number(gsap.getProperty(record, "x")) || 0;
    const currentY = Number(gsap.getProperty(record, "y")) || 0;
    const deltaX =
      deckRecordBounds.left +
      deckRecordBounds.width / 2 -
      (recordBounds.left + recordBounds.width / 2);
    const deltaY =
      deckRecordBounds.top +
      deckRecordBounds.height / 2 -
      (recordBounds.top + recordBounds.height / 2);
    const landingScale =
      currentScale *
      (deckRecordBounds.width / Math.max(recordBounds.width, 1));
    const targetX = currentX + deltaX;
    const targetY = currentY + deltaY;

    sequenceRef.current?.kill();
    gsap.set(deckRecord, { autoAlpha: 0 });
    gsap.set(record, {
      transformPerspective: 1100,
      transformOrigin: "50% 50%",
      willChange: "transform, opacity",
    });

    if (reducedMotion) {
      const reducedSequence = gsap.timeline({
        onComplete: () => {
          tonearmAngleRef.current = TONEARM_PLAY_ANGLE;
          setTonearmAngle(TONEARM_PLAY_ANGLE);
          setTonearmRaised(false);
          setMotorOn(true);
          updatePhase("playing");
        },
      });
      sequenceRef.current = reducedSequence;
      reducedSequence
        .to(rackRef.current, { autoAlpha: 0, duration: 0.14, ease: "none" }, 0)
        .to(turntable, { autoAlpha: 1, duration: 0.16, ease: "none" }, 0)
        .set([sleeve, record], { autoAlpha: 0 }, 0.12)
        .set(deckRecord, { autoAlpha: 1 }, 0.12)
        .set(tonearmRef.current, { rotationZ: TONEARM_PLAY_ANGLE }, 0.12);
      return;
    }

    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = TONEARM_PLAY_ANGLE;
        setTonearmAngle(TONEARM_PLAY_ANGLE);
        setTonearmRaised(false);
        updatePhase("playing");
      },
    });
    sequenceRef.current = sequence;
    sequence
      .addLabel("extract", 0)
      .addLabel("travel", 0.22)
      .addLabel("align", 0.66)
      .addLabel("drop", 0.93)
      .addLabel("spin", 1.08)
      .addLabel("needle", 1.16)
      .to(
        rackRef.current,
        {
          autoAlpha: 0,
          scale: 1.018,
          duration: 0.36,
          ease: "power2.in",
        },
        "extract",
      )
      .fromTo(
        turntable,
        { autoAlpha: 0 },
        {
          autoAlpha: 1,
          duration: 0.42,
          ease: "power3.out",
        },
        0.12,
      )
      .to(
        sleeve,
        {
          x: "-=24",
          y: "+=30",
          scale: 0.88,
          rotationX: 4,
          rotationY: -10,
          rotationZ: -7,
          autoAlpha: 0,
          duration: 0.42,
          ease: "power3.in",
        },
        "extract+=0.06",
      )
      .to(
        record,
        {
          x: currentX + 68,
          y: currentY - 22,
          scale: currentScale * 1.025,
          rotationX: -11,
          rotationZ: -3,
          duration: 0.24,
          ease: "expo.out",
        },
        "extract",
      )
      .to(
        record,
        {
          x: currentX + deltaX * 0.56,
          y: currentY + deltaY * 0.56 - 82,
          scale: landingScale * 1.075,
          rotationX: -14,
          rotationY: 4,
          rotationZ: 16,
          duration: 0.5,
          ease: "power2.inOut",
        },
        "travel",
      )
      .to(
        record,
        {
          x: targetX,
          y: targetY - 28,
          scale: landingScale * 1.012,
          rotationX: -2,
          rotationY: 0,
          rotationZ: 2,
          duration: 0.3,
          ease: "power3.in",
        },
        "align",
      )
      .to(
        record,
        {
          y: targetY,
          scale: landingScale,
          rotationZ: 0,
          rotationX: 0,
          duration: 0.18,
          ease: "back.out(1.25)",
        },
        "drop",
      )
      .set(record, { autoAlpha: 0 }, "spin")
      .set(deckRecord, { autoAlpha: 1 }, "spin")
      .call(() => setMotorOn(true), undefined, "spin")
      .fromTo(
        deckRecord,
        { scale: 1.012 },
        {
          scale: 1,
          duration: 0.14,
          ease: "power2.out",
        },
        "spin",
      )
      .to(
        stylusRef.current,
        {
          y: -7,
          duration: 0.1,
          ease: "power2.out",
        },
        "needle",
      )
      .to(
        tonearmRef.current,
        {
          rotationZ: TONEARM_PLAY_ANGLE,
          duration: 0.48,
          ease: "power2.inOut",
        },
        "needle+=0.04",
      )
      .to(
        stylusRef.current,
        {
          y: 0,
          duration: 0.16,
          ease: "sine.inOut",
        },
        "needle+=0.5",
      )
      .set(record, { willChange: "auto" }, "needle+=0.68");
  }, [reducedMotion, selectedIndex, updatePhase]);

  const closeSleeve = useCallback(() => {
    if (
      phaseRef.current !== "showcase" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !rackRef.current
    ) {
      return;
    }

    updatePhase("closing");

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveBounds = sleeve.getBoundingClientRect();
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const targetX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const targetY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const targetScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(sleeveBounds.width, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const duration = reducedMotion ? 0.18 : 0.72;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;
    sequence
      .to(record, {
        x: gsap.getProperty(sleeve, "x") as number,
        duration: duration * 0.42,
        ease: "power2.inOut",
      })
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: reducedMotion ? 0.08 : duration * 0.54,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        `>-${duration * 0.12}`,
      )
      .to(
        rackRef.current,
        {
          opacity: 0.58,
          filter: reducedMotion ? "none" : "blur(0.8px)",
          duration: reducedMotion ? 0.08 : duration * 0.4,
          ease: "power2.out",
        },
        "<",
      )
      .to(
        [sleeve, record],
        {
          x: targetX,
          y: targetY,
          scale: targetScale,
          rotationX: shelfPose.rotationX,
          rotationY: shelfPose.rotationY,
          rotationZ: 0,
          duration,
          ease: "power3.inOut",
        },
        ">",
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: reducedMotion ? 0.01 : 0.1,
        },
        ">-0.1",
      )
      .to(
        rackRef.current,
        {
          opacity: 1,
          y: 0,
          filter: "none",
          duration: duration * 0.58,
          ease: "power2.out",
        },
        `>-${duration * 0.34}`,
      );
  }, [
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    updatePhase,
  ]);

  const returnRecord = useCallback(() => {
    const turntable = rootRef.current?.querySelector<HTMLElement>(
      "[data-turntable]",
    );

    if (
      phaseRef.current !== "playing" ||
      selectedIndex === null ||
      !sleeveRef.current ||
      !floatingRecordRef.current ||
      !platterRef.current ||
      !deckRecordRef.current ||
      !tonearmRef.current ||
      !stylusRef.current ||
      !rackRef.current ||
      !turntable
    ) {
      return;
    }

    updatePhase("returning");
    setTonearmRaised(true);

    const sleeve = sleeveRef.current;
    const record = floatingRecordRef.current;
    const deckRecord = deckRecordRef.current;
    const selectedSlot = slotRefs.current[selectedIndex];

    if (selectedSlot) {
      gsap.set(selectedSlot, {
        visibility: "hidden",
      });
    }

    const slotBounds = selectedSlot
      ?.querySelector<HTMLElement>("[data-shelf-sleeve]")
      ?.getBoundingClientRect();
    const sleeveSize = sleeve.getBoundingClientRect().width;
    const shelfPose = getShelfEntryPose(
      selectedIndex,
      positionRef.current.value,
      reducedMotion,
    );
    const platterBounds = platterRef.current.getBoundingClientRect();
    const pose = getShowcasePose(sleeveSize);
    const platterX =
      platterBounds.left + platterBounds.width / 2 - window.innerWidth / 2;
    const platterY =
      platterBounds.top + platterBounds.height / 2 - window.innerHeight / 2;
    const platterScale =
      (platterBounds.width * 0.82) / Math.max(sleeveSize, 1);
    const shelfX = slotBounds
      ? slotBounds.left + slotBounds.width / 2 - window.innerWidth / 2
      : 0;
    const shelfY = slotBounds
      ? slotBounds.top + slotBounds.height / 2 - window.innerHeight / 2
      : window.innerHeight * 0.33;
    const shelfScale = slotBounds
      ? clamp(
          (shelfPose.axis === "x" ? slotBounds.height : slotBounds.width) /
            Math.max(sleeveSize, 1),
          0.38,
          1.9,
        )
      : 0.65;
    const motionBeat = reducedMotion ? 0.25 : 1;

    sequenceRef.current?.kill();
    const sequence = gsap.timeline({
      onComplete: () => {
        tonearmAngleRef.current = TONEARM_HOME_ANGLE;
        setTonearmAngle(TONEARM_HOME_ANGLE);
        setTonearmRaised(true);
        setMotorOn(false);
        restoreShelfAlbum(selectedIndex);
        setSelectedIndex(null);
        setLoadedIndex(null);
        updatePhase("browsing");
      },
    });
    sequenceRef.current = sequence;

    sequence
      .to(
        stylusRef.current,
        {
          y: reducedMotion ? -1 : -7,
          duration: 0.12 * motionBeat,
          ease: "power2.out",
        },
        0,
      )
      .to(
        tonearmRef.current,
        {
          rotationZ: TONEARM_HOME_ANGLE,
          duration: 0.45 * motionBeat,
          ease: "power2.inOut",
        },
        0.06 * motionBeat,
      )
      .to(
        stylusRef.current,
        {
          y: 0,
          duration: 0.1 * motionBeat,
        },
        0.46 * motionBeat,
      )
      .to(
        deckRecord,
        {
          autoAlpha: 0,
          duration: 0.12 * motionBeat,
        },
        0.42 * motionBeat,
      )
      .to(
        turntable,
        {
          autoAlpha: 0,
          scale: reducedMotion ? 1 : 0.955,
          duration: 0.22 * motionBeat,
          ease: "power2.in",
        },
        0.44 * motionBeat,
      )
      .call(() => setMotorOn(false), undefined, 0.48 * motionBeat)
      .set(
        record,
        {
          x: platterX,
          y: platterY,
          scale: platterScale,
          rotationX: 0,
          rotationY: 0,
          rotationZ: -3,
          autoAlpha: 1,
        },
        0.5 * motionBeat,
      )
      .to(
        record,
        {
          x: pose.x + pose.recordX,
          y: pose.y - (reducedMotion ? 0 : 34),
          scale: 0.975,
          rotationX: 0,
          rotationZ: -2,
          duration: 0.5 * motionBeat,
          ease: reducedMotion ? "power1.out" : "power3.inOut",
        },
        0.5 * motionBeat,
      )
      .to(
        record,
        {
          y: pose.y,
          duration: 0.1 * motionBeat,
          ease: "power2.out",
        },
        0.95 * motionBeat,
      )
      .set(
        sleeve,
        {
          x: pose.x,
          y: pose.y,
          scale: 0.88,
          rotationX: 0,
          rotationY: 0,
          rotationZ: reducedMotion ? 0 : -4.6,
          autoAlpha: 1,
        },
        0.88 * motionBeat,
      )
      .to(
        sleeve,
        {
          scale: 1,
          rotationZ: reducedMotion ? 0 : -4.6,
          duration: 0.2 * motionBeat,
          ease: "power2.out",
        },
        0.9 * motionBeat,
      )
      .to(
        record,
        {
          x: pose.x,
          duration: 0.28 * motionBeat,
          ease: "power2.inOut",
        },
        1.05 * motionBeat,
      )
      .to(
        gapProgressRef.current,
        {
          value: 0,
          duration: 0.34 * motionBeat,
          ease: "power3.inOut",
          onUpdate: layoutShelf,
        },
        1.15 * motionBeat,
      )
      .to(
        rackRef.current,
        {
          autoAlpha: 0.58,
          scale: reducedMotion ? 1 : 1.018,
          filter: reducedMotion ? "none" : "blur(0.8px)",
          duration: 0.3 * motionBeat,
          ease: "power2.out",
        },
        1.15 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          x: shelfX,
          y: shelfY - (reducedMotion ? 0 : 22),
          scale: shelfScale,
          rotationX: shelfPose.rotationX,
          rotationY: shelfPose.rotationY,
          rotationZ: 0,
          duration: 0.48 * motionBeat,
          ease: "power3.inOut",
        },
        1.34 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          y: shelfY,
          duration: 0.12 * motionBeat,
          ease: "power2.in",
        },
        1.78 * motionBeat,
      )
      .to(
        [sleeve, record],
        {
          autoAlpha: 0,
          duration: 0.08 * motionBeat,
        },
        1.88 * motionBeat,
      )
      .to(
        rackRef.current,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          filter: "none",
          duration: 0.35 * motionBeat,
          ease: "power2.out",
        },
        1.48 * motionBeat,
      );
  }, [
    layoutShelf,
    reducedMotion,
    restoreShelfAlbum,
    selectedIndex,
    updatePhase,
  ]);

  const selectPlayingAlbum = useCallback(
    (requestedIndex: number) => {
      if (
        phaseRef.current !== "playing" ||
        loadedIndex === null ||
        selectedIndex === null ||
        !deckRecordRef.current ||
        !tonearmRef.current ||
        !stylusRef.current
      ) {
        return;
      }

      const nextIndex = wrapAlbumIndex(requestedIndex);
      if (nextIndex === loadedIndex) {
        return;
      }

      const deckRecord = deckRecordRef.current;
      const tonearm = tonearmRef.current;
      const stylus = stylusRef.current;
      const resumeAfterSwitch = motorOn && !tonearmRaised;
      const beat = reducedMotion ? 0.22 : 1;

      const updateAlbum = () => {
        const previousSlot = slotRefs.current[loadedIndex];
        const nextSlot = slotRefs.current[nextIndex];

        if (previousSlot) {
          gsap.set(previousSlot, { visibility: "visible", autoAlpha: 1 });
        }

        positionRef.current.value = getNearestVirtualPosition(
          nextIndex,
          positionRef.current.value,
        );
        removedIndexRef.current = nextIndex;
        gapProgressRef.current.value = 1;

        if (nextSlot) {
          gsap.set(nextSlot, { visibility: "hidden" });
        }

        setActiveIndex(nextIndex);
        setSelectedIndex(nextIndex);
        setLoadedIndex(nextIndex);
        setSpeed(vinylAlbums[nextIndex].vinyl.rpm === 45 ? 45 : 33);
        layoutShelf();
      };

      updatePhase("switching");
      setMotorOn(false);
      setTonearmRaised(true);
      sequenceRef.current?.kill();

      const sequence = gsap.timeline({
        onComplete: () => {
          tonearmAngleRef.current = TONEARM_PLAY_ANGLE;
          setTonearmAngle(TONEARM_PLAY_ANGLE);
          setTonearmRaised(false);
          setMotorOn(resumeAfterSwitch);
          updatePhase("playing");
        },
      });
      sequenceRef.current = sequence;
      sequence
        .to(stylus, {
          y: reducedMotion ? -1 : -7,
          duration: 0.1 * beat,
          ease: "power2.out",
        })
        .to(
          tonearm,
          {
            rotationZ: TONEARM_HOME_ANGLE,
            duration: 0.28 * beat,
            ease: "power2.inOut",
          },
          0.04 * beat,
        )
        .to(
          deckRecord,
          {
            autoAlpha: 0,
            scale: 0.965,
            duration: 0.18 * beat,
            ease: "power2.in",
          },
          0.12 * beat,
        )
        .call(updateAlbum, undefined, 0.3 * beat)
        .fromTo(
          deckRecord,
          { autoAlpha: 0, scale: 1.035 },
          {
            autoAlpha: 1,
            scale: 1,
            duration: 0.24 * beat,
            ease: "power3.out",
          },
          0.35 * beat,
        )
        .to(
          tonearm,
          {
            rotationZ: TONEARM_PLAY_ANGLE,
            duration: 0.36 * beat,
            ease: "power2.inOut",
          },
          0.44 * beat,
        )
        .to(
          stylus,
          {
            y: 0,
            duration: 0.14 * beat,
            ease: "sine.inOut",
          },
          0.76 * beat,
        );
    },
    [
      layoutShelf,
      loadedIndex,
      motorOn,
      reducedMotion,
      selectedIndex,
      tonearmRaised,
      updatePhase,
    ],
  );

  const playPreviousAlbum = useCallback(() => {
    if (loadedIndex !== null) {
      selectPlayingAlbum(loadedIndex - 1);
    }
  }, [loadedIndex, selectPlayingAlbum]);

  const playNextAlbum = useCallback(
    (shuffle = false) => {
      if (loadedIndex === null) {
        return;
      }

      let nextIndex = loadedIndex + 1;
      if (shuffle && vinylAlbums.length > 1) {
        const offset = 1 + Math.floor(Math.random() * (vinylAlbums.length - 1));
        nextIndex = loadedIndex + offset;
      }

      selectPlayingAlbum(nextIndex);
    },
    [loadedIndex, selectPlayingAlbum],
  );

  useEffect(() => {
    const handleGlobalKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      if (phaseRef.current === "showcase") {
        closeSleeve();
      } else if (phaseRef.current === "playing") {
        returnRecord();
      }
    };

    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, [closeSleeve, returnRecord]);

  const statusText = (() => {
    if (!selectedAlbum) {
      return `${vinylAlbums[activeIndex].title} is focused in the three-dimensional album shelf.`;
    }

    if (phase === "playing") {
      return motorOn && !tonearmRaised
        ? `${selectedAlbum.title} is playing.`
        : `${selectedAlbum.title} is paused.`;
    }

    if (phase === "showcase") {
      return `${selectedAlbum.title} is out of the rack. Select the exposed record to play it.`;
    }

    return `${selectedAlbum.title} is being handled.`;
  })();

  return (
    <main
      ref={rootRef}
      className={styles.page}
      data-phase={phase}
    >
      <div className={styles.roomGrain} aria-hidden="true" />

      <div className={styles.turntableStage} data-turntable>
        <Turntable
          phase={phase}
          album={loadedAlbum}
          onEject={returnRecord}
          onPrevious={playPreviousAlbum}
          onNext={playNextAlbum}
          onSelectAlbum={selectPlayingAlbum}
          motorOn={motorOn}
          speed={speed}
          tonearmAngle={tonearmAngle}
          tonearmRaised={tonearmRaised}
          tonearmDragging={tonearmDragging}
          onTogglePlayback={togglePlayback}
          onToggleSpeed={toggleSpeed}
          onToggleCue={toggleCue}
          onTonearmPointerDown={handleTonearmPointerDown}
          onTonearmPointerMove={handleTonearmPointerMove}
          onTonearmPointerUp={finishTonearmGesture}
          onTonearmKeyDown={handleTonearmKeyDown}
          platterRef={platterRef}
          deckRecordRef={deckRecordRef}
          tonearmBaseRef={tonearmBaseRef}
          tonearmRef={tonearmRef}
          stylusRef={stylusRef}
        />
      </div>

      <section
        ref={rackRef}
        className={styles.recordRack}
        data-rack
        tabIndex={0}
        aria-label="Kanye West record collection, interactive three-dimensional album shelf"
        aria-describedby="vinyl-status"
        onPointerDown={handleRackPointerDown}
        onPointerMove={handleRackPointerMove}
        onPointerUp={finishRackGesture}
        onPointerCancel={finishRackGesture}
        onWheel={handleShelfWheel}
        onKeyDown={handleRackKeyDown}
      >
        <div className={styles.rackBackdrop} aria-hidden="true" />
        <header className={styles.rackHeader} aria-hidden="true">
          <span>Albums</span>
          <span>Drag to browse · Click to pull</span>
        </header>
        <div className={styles.focusGlow} aria-hidden="true" />
        <div className={styles.rackTrack}>
          {shelfInstances.map(
            ({ album, albumIndex: index, cycle, key }, instanceIndex) => {
              const albumStyle = {
                "--spine-color": album.spine,
                "--edge-color": album.edge,
                "--spine-ink": getContrastingInk(album.spine),
              } as CSSProperties;
              const canonical = cycle === 0;

              return (
                <button
                  key={key}
                  ref={(node) => {
                    shelfItemRefs.current[instanceIndex] = node;
                    if (canonical) {
                      slotRefs.current[index] = node;
                    }
                  }}
                  type="button"
                  className={styles.shelfSlot}
                  style={albumStyle}
                  disabled={!canonical || phase !== "browsing"}
                  tabIndex={canonical ? 0 : -1}
                  data-shelf-slot
                  data-record-index={index}
                  data-shelf-cycle={cycle}
                  data-shelf-clone={canonical ? undefined : true}
                  data-active={canonical && index === activeIndex}
                  aria-label={
                    canonical
                      ? `Select ${album.title}, ${album.year}`
                      : undefined
                  }
                  aria-hidden={canonical ? undefined : true}
                  aria-current={
                    canonical && index === activeIndex ? "true" : undefined
                  }
                  onClick={(event) => {
                    if (event.detail === 0) {
                      focusAlbum(index, true);
                    }
                  }}
                >
                  <span
                    className={`${styles.shelfSleeve} ${styles.sleeveShell}`}
                    data-shelf-sleeve
                  >
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveFront}`}
                    >
                      <Image
                        src={album.cover}
                        alt=""
                        fill
                        sizes="(max-width: 719px) 68vw, min(68vh, 64vw)"
                        loading={canonical ? "eager" : "lazy"}
                        draggable={false}
                      />
                    </span>
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveRear}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveLeft}`}
                      aria-hidden="true"
                    >
                      <span className={styles.shelfSpineLabel}>
                        <strong>{album.title}</strong>
                        <small>{album.artist}</small>
                      </span>
                    </span>
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveRight}`}
                      aria-hidden="true"
                    >
                      <span className={styles.shelfSpineLabel}>
                        <strong>{album.title}</strong>
                        <small>{album.artist}</small>
                      </span>
                    </span>
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveTop}`}
                      aria-hidden="true"
                    >
                      <span className={styles.shelfSpineLabel}>
                        <strong>{album.title}</strong>
                        <small>{album.artist}</small>
                      </span>
                    </span>
                    <span
                      className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveBottom}`}
                      aria-hidden="true"
                    >
                      <span className={styles.shelfSpineLabel}>
                        <strong>{album.title}</strong>
                        <small>{album.artist}</small>
                      </span>
                    </span>
                  </span>
                  <span className={styles.albumMeta} aria-hidden="true">
                    <span className={styles.albumTitle}>{album.title}</span>
                    <span className={styles.albumArtist}>{album.artist}</span>
                  </span>
                </button>
              );
            },
          )}
        </div>
        <div
          key={`readout-${vinylAlbums[activeIndex].id}`}
          className={styles.activeAlbumReadout}
          aria-hidden="true"
        >
          <strong>{vinylAlbums[activeIndex].title}</strong>
          <span>
            {vinylAlbums[activeIndex].artist} · {vinylAlbums[activeIndex].year}
          </span>
        </div>
        <div className={styles.rackProgress} aria-hidden="true">
          <span />
          <span data-current="true" />
          <span />
        </div>
      </section>

      {selectedAlbum ? (
        <div className={styles.presentationLayer}>
          <button
            ref={floatingRecordRef}
            type="button"
            className={styles.floatingRecord}
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Take ${selectedAlbum.title} out of its sleeve and play it`}
          >
            <VinylRecord
              album={selectedAlbum}
              playing={false}
              className={styles.floatingVinyl}
              variant="floating"
            />
          </button>

          <button
            ref={sleeveRef}
            type="button"
            className={styles.presentedSleeve}
            style={
              {
                "--spine-color": selectedAlbum.spine,
                "--edge-color": selectedAlbum.edge,
                "--spine-ink": getContrastingInk(selectedAlbum.spine),
              } as CSSProperties
            }
            onClick={placeRecord}
            disabled={phase !== "showcase"}
            aria-label={`Play ${selectedAlbum.title}`}
          >
            <span
              className={`${styles.sleeveShell} ${styles.presentedSleeveShell}`}
            >
              <span className={`${styles.sleeveFace} ${styles.sleeveFront}`}>
                <Image
                  src={selectedAlbum.cover}
                  alt={`${selectedAlbum.title} album cover`}
                  fill
                  sizes="(max-width: 720px) 82vw, 440px"
                  priority
                  draggable={false}
                />
              </span>
              <span
                className={`${styles.sleeveFace} ${styles.sleeveRear}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveLeft}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveRight}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveTop}`}
                aria-hidden="true"
              />
              <span
                className={`${styles.sleeveFace} ${styles.sleeveWall} ${styles.sleeveBottom}`}
                aria-hidden="true"
              />
            </span>
          </button>

          <div className={styles.showcasePanel} aria-live="polite">
            <span className={styles.showcaseEyebrow}>Selected record</span>
            <h1>{selectedAlbum.title}</h1>
            <p>
              {selectedAlbum.artist} <span aria-hidden="true">·</span>{" "}
              {selectedAlbum.year}
            </p>
            <div className={styles.showcaseActions}>
              <button
                type="button"
                className={styles.showcaseSecondary}
                onClick={closeSleeve}
                disabled={phase !== "showcase"}
              >
                <X aria-hidden="true" />
                <span>Back</span>
              </button>
              <button
                type="button"
                className={styles.showcasePrimary}
                onClick={placeRecord}
                disabled={phase !== "showcase"}
              >
                <Play fill="currentColor" aria-hidden="true" />
                <span>Play record</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <p id="vinyl-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </main>
  );
}
