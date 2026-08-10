"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BrowserQRCodeReader,
  type IScannerControls,
} from "@zxing/browser";

type ScannerClientProps = {
  stationId: string;
  stationName: string;
  sessionCode: string;
  sessionName: string;
};

type ParticipantDisplay = {
  registrationId: string;
  fullName: string;
  institution: string;
  participantCategory: string;
};

type SessionDisplay = {
  code: string;
  name: string;
};

type SafeParticipantResult = {
  participant: ParticipantDisplay;
  session: SessionDisplay;
  checkedAt: string;
};

type SafeScanResult =
  | SafeParticipantResult & {
      status: "success" | "success-with-warning" | "already-checked-in";
      message?: string;
    }
  | {
      status:
        | "invalid-qr"
        | "cancelled-participant"
        | "invalid-station"
        | "station-not-paired"
        | "station-owned-by-other-operator"
        | "closed-session"
        | "forbidden"
        | "unauthorized"
        | "internal-error"
        | "invalid-request"
        | "network-error";
      message: string;
    };

type CameraStatus = "off" | "starting" | "ready" | "processing";

const safeMessages: Record<
  Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">,
  string
> = {
  "invalid-qr": "QR tidak valid.",
  "cancelled-participant": "Pendaftaran peserta telah dibatalkan.",
  "invalid-station": "Station tidak dapat digunakan.",
  "station-not-paired": "Station belum siap digunakan.",
  "station-owned-by-other-operator": "Station terikat ke operator lain.",
  "closed-session": "Session check-in belum dibuka atau telah ditutup.",
  forbidden: "Anda tidak memiliki akses untuk melakukan scan.",
  unauthorized: "Authentication diperlukan.",
  "internal-error": "Terjadi kendala saat memproses scan. Silakan coba kembali.",
  "invalid-request": "Request scan tidak valid.",
  "network-error": "Koneksi gagal. Periksa koneksi internet lalu coba kembali.",
};

const knownErrorStatuses = new Set<
  Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">
>([
  "invalid-qr",
  "cancelled-participant",
  "invalid-station",
  "station-not-paired",
  "station-owned-by-other-operator",
  "closed-session",
  "forbidden",
  "unauthorized",
  "internal-error",
  "invalid-request",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readParticipant(value: unknown): ParticipantDisplay | null {
  if (!isRecord(value)) {
    return null;
  }

  const registrationId = value.registrationId;
  const fullName = value.fullName;
  const institution = value.institution;
  const participantCategory = value.participantCategory;

  if (
    typeof registrationId !== "string" ||
    typeof fullName !== "string" ||
    typeof institution !== "string" ||
    typeof participantCategory !== "string"
  ) {
    return null;
  }

  return {
    registrationId,
    fullName,
    institution,
    participantCategory,
  };
}

function readSession(value: unknown): SessionDisplay | null {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.code !== "string" || typeof value.name !== "string") {
    return null;
  }

  return {
    code: value.code,
    name: value.name,
  };
}

function readParticipantResult(
  payload: Record<string, unknown>,
): SafeParticipantResult | null {
  const participant = readParticipant(payload.participant);
  const session = readSession(payload.session);
  const checkedAt = payload.checkedAt;

  if (!participant || !session || typeof checkedAt !== "string") {
    return null;
  }

  return {
    participant,
    session,
    checkedAt,
  };
}

function parseScanResponse(payload: unknown, httpStatus: number): SafeScanResult {
  if (!isRecord(payload) || typeof payload.status !== "string") {
    return {
      status: "internal-error",
      message: safeMessages["internal-error"],
    };
  }

  const status = payload.status;

  if (
    status === "success" ||
    status === "success-with-warning" ||
    status === "already-checked-in"
  ) {
    const participantResult = readParticipantResult(payload);

    if (!participantResult) {
      return {
        status: "internal-error",
        message: safeMessages["internal-error"],
      };
    }

    if (status === "success-with-warning") {
      return {
        status,
        ...participantResult,
        message:
          "Peserta berhasil check-in untuk sesi seminar, tetapi belum tercatat pada sesi kedatangan (ARRIVAL).",
      };
    }

    return {
      status,
      ...participantResult,
      ...(status === "already-checked-in"
        ? { message: "Peserta sudah check-in pada sesi ini." }
        : {}),
    };
  }

  if (knownErrorStatuses.has(status as Exclude<SafeScanResult["status"], "success" | "success-with-warning" | "already-checked-in">)) {
    return {
      status: status as Exclude<
        SafeScanResult["status"],
        "success" | "success-with-warning" | "already-checked-in" | "network-error"
      >,
      message:
        safeMessages[
          status as Exclude<
            SafeScanResult["status"],
            "success" | "success-with-warning" | "already-checked-in"
          >
        ],
    };
  }

  if (httpStatus === 401) {
    return {
      status: "unauthorized",
      message: safeMessages.unauthorized,
    };
  }

  if (httpStatus === 403) {
    return {
      status: "forbidden",
      message: safeMessages.forbidden,
    };
  }

  return {
    status: "internal-error",
    message: safeMessages["internal-error"],
  };
}

function formatCheckedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function cameraErrorMessage(error: unknown) {
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError")
  ) {
    return "Izin kamera diperlukan untuk melakukan scan.";
  }

  return "Kamera tidak dapat digunakan. Periksa izin kamera lalu coba kembali.";
}

export function ScannerClient({
  stationId,
  stationName,
  sessionCode,
  sessionName,
}: ScannerClientProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const startingRef = useRef(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("off");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<SafeScanResult | null>(null);

  function stopVideoTracks() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const stream = video.srcObject;

    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    video.pause();
    video.srcObject = null;
  }

  function stopCamera() {
    generationRef.current += 1;

    try {
      controlsRef.current?.stop();
    } catch {
      // Camera cleanup should remain safe if the browser already stopped it.
    }

    controlsRef.current = null;
    readerRef.current = null;
    stopVideoTracks();
    startingRef.current = false;

    if (mountedRef.current && !processingRef.current) {
      setCameraStatus("off");
    }
  }

  async function submitScan(qrValue: string) {
    try {
      const response = await fetch("/admin/scanner/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({ stationId, qrValue }),
      });

      let payload: unknown;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      const result = parseScanResponse(payload, response.status);

      if (mountedRef.current) {
        setScanResult(result);
      }
    } catch {
      if (mountedRef.current) {
        setScanResult({
          status: "network-error",
          message: safeMessages["network-error"],
        });
      }
    } finally {
      processingRef.current = false;

      if (mountedRef.current) {
        setCameraStatus("off");
      }
    }
  }

  async function startCamera() {
    if (
      startingRef.current ||
      processingRef.current ||
      cameraStatus === "ready"
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Kamera tidak dapat digunakan pada browser ini.");
      setCameraStatus("off");
      return;
    }

    startingRef.current = true;
    const generation = ++generationRef.current;
    setCameraError(null);
    setCameraStatus("starting");

    const reader = new BrowserQRCodeReader(undefined, {
      delayBetweenScanSuccess: 500,
      delayBetweenScanAttempts: 200,
    });

    readerRef.current = reader;

    try {
      const video = videoRef.current;

      if (!video) {
        throw new Error("Video preview is unavailable.");
      }

      const controls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
        },
        video,
        (result) => {
          if (!result || processingRef.current) {
            return;
          }

          processingRef.current = true;
          setCameraStatus("processing");
          stopCamera();

          const qrValue = result.getText();
          void submitScan(qrValue);
        },
      );

      if (
        generation !== generationRef.current ||
        processingRef.current ||
        !mountedRef.current
      ) {
        controls.stop();
        stopVideoTracks();
        return;
      }

      controlsRef.current = controls;
      setCameraStatus("ready");
    } catch (error) {
      const wasCancelled = generation !== generationRef.current;
      stopCamera();

      if (mountedRef.current && !processingRef.current && !wasCancelled) {
        setCameraError(cameraErrorMessage(error));
        setCameraStatus("off");
      }
    } finally {
      startingRef.current = false;
    }
  }

  function handleNextScan() {
    if (processingRef.current) {
      return;
    }

    setScanResult(null);
    setCameraError(null);
    void startCamera();
  }

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      generationRef.current += 1;

      try {
        controlsRef.current?.stop();
      } catch {
        // The browser may have already released the camera during navigation.
      }

      controlsRef.current = null;
      readerRef.current = null;
      stopVideoTracks();
    };
  }, []);

  const hasResult = scanResult !== null;
  const isCameraActive = cameraStatus === "starting" || cameraStatus === "ready";
  const cameraStatusLabel = {
    off: "Kamera belum aktif",
    starting: "Memulai kamera...",
    ready: "Siap memindai QR",
    processing: "Memproses...",
  }[cameraStatus];

  return (
    <main className="min-h-screen bg-[#f7f3ea] px-4 py-6 sm:px-8 sm:py-8">
      <section className="mx-auto max-w-3xl">
        <header className="flex flex-col gap-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-[#9a7526]">
                AKKAI 2026
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-[#142842]">
                Scanner Check-in
              </h1>
            </div>
            <div className="flex flex-wrap gap-4 text-sm font-medium">
              <Link
                className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                href="/admin/scanner/pair"
              >
                Pairing Scanner
              </Link>
              <Link
                className="text-[#344d68] underline underline-offset-4 hover:text-[#142842]"
                href="/admin/dashboard"
              >
                Dashboard
              </Link>
            </div>
          </div>

          <dl className="grid gap-3 rounded-xl bg-[#f1eadc] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                Station
              </dt>
              <dd className="mt-1 font-semibold text-[#142842]">{stationName}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
                Session
              </dt>
              <dd className="mt-1 font-semibold text-[#142842]">
                {sessionCode} - {sessionName}
              </dd>
            </div>
          </dl>
        </header>

        <section className="mt-5 rounded-2xl border border-[#e4d8c4] bg-[#fffdf8] p-4 shadow-sm sm:p-6">
          <div className="relative overflow-hidden rounded-xl bg-[#142842] aspect-[4/3] sm:aspect-video">
            <video
              aria-label="Preview kamera scanner"
              autoPlay
              className={`h-full w-full object-cover ${isCameraActive ? "block" : "hidden"}`}
              muted
              playsInline
              ref={videoRef}
            />
            {isCameraActive ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-2/3 w-2/3 rounded-2xl border-2 border-[#d9ad45] shadow-[0_0_0_999px_rgba(20,40,66,0.28)]" />
              </div>
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[#f7f3ea]">
                Kamera dihentikan. Tekan Mulai Kamera untuk memulai scan.
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-[#f1eadc] px-4 py-3 text-sm">
            <span className="font-medium text-[#344d68]">Status kamera</span>
            <span className="font-semibold text-[#142842]">{cameraStatusLabel}</span>
          </div>

          {cameraError ? (
            <p className="mt-4 rounded-lg border border-[#ead3cc] bg-[#fff5f2] p-4 text-sm text-[#9b3d31]" role="alert">
              {cameraError}
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <button
              className="rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cameraStatus === "starting" || cameraStatus === "ready" || cameraStatus === "processing" || hasResult}
              onClick={() => void startCamera()}
              type="button"
            >
              {cameraStatus === "starting" ? "Memulai Kamera..." : "Mulai Kamera"}
            </button>
            <button
              className="rounded-lg border border-[#b99a5a] px-4 py-3 text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={cameraStatus === "off" || cameraStatus === "processing"}
              onClick={stopCamera}
              type="button"
            >
              Hentikan Kamera
            </button>
          </div>

          <div className="mt-4 border-t border-[#eee6d8] pt-4">
            <Link
              className="text-sm font-medium text-[#6d531e] underline decoration-[#b99a5a] underline-offset-4 hover:text-[#142842]"
              href={`/admin/scanner/${stationId}/manual`}
            >
              QR bermasalah? Check-in Manual
            </Link>
          </div>
        </section>

        {scanResult ? (
          <section
            className={`mt-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${
              scanResult.status === "success"
                ? "border-[#b9dec8] bg-[#f3fbf5]"
                : scanResult.status === "success-with-warning"
                  ? "border-[#e5cb8c] bg-[#fff9eb]"
                  : scanResult.status === "already-checked-in"
                    ? "border-[#b8cce2] bg-[#f3f8fd]"
                    : "border-[#ead3cc] bg-[#fff5f2]"
            }`}
            role="status"
          >
            <ScanResultView result={scanResult} />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                className="rounded-lg bg-[#142842] px-4 py-3 text-sm font-semibold text-white hover:bg-[#203d5d] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={cameraStatus === "processing"}
                onClick={handleNextScan}
                type="button"
              >
                Scan Berikutnya
              </button>
              {scanResult.status === "invalid-station" ||
              scanResult.status === "station-not-paired" ||
              scanResult.status === "station-owned-by-other-operator" ? (
                <Link
                  className="rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
                  href="/admin/scanner/pair"
                >
                  Kembali ke Pairing
                </Link>
              ) : null}
              {scanResult.status === "closed-session" ||
              scanResult.status === "forbidden" ||
              scanResult.status === "unauthorized" ? (
                <Link
                  className="rounded-lg border border-[#b99a5a] px-4 py-3 text-center text-sm font-semibold text-[#6d531e] hover:bg-[#fbf5e8]"
                  href="/admin/dashboard"
                >
                  Kembali ke Dashboard
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function ScanResultView({ result }: { result: SafeScanResult }) {
  if (
    result.status === "success" ||
    result.status === "success-with-warning" ||
    result.status === "already-checked-in"
  ) {
    const heading =
      result.status === "success"
        ? "Check-in Berhasil"
        : result.status === "success-with-warning"
          ? "CHECK-IN SEMINAR BERHASIL DENGAN CATATAN"
          : "Sudah Check-in";

    return (
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9a7526]">
          {heading}
        </p>
        <h2 className="mt-2 text-2xl font-bold text-[#142842]">
          {result.participant.fullName}
        </h2>
        <dl className="mt-5 grid gap-3 text-sm text-[#344d68] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Registration ID
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.registrationId}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Institusi
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.institution}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Kategori
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.participant.participantCategory}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Session
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {result.session.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#897657]">
              Waktu Check-in
            </dt>
            <dd className="mt-1 font-semibold text-[#142842]">
              {formatCheckedAt(result.checkedAt)}
            </dd>
          </div>
        </dl>
        {result.message ? (
          <p className="mt-5 rounded-lg bg-white/70 p-3 text-sm font-medium text-[#6d531e]">
            {result.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9b3d31]">
        {result.status === "invalid-qr"
          ? "QR Tidak Valid"
          : result.status === "cancelled-participant"
            ? "Pendaftaran Dibatalkan"
            : "Scan Tidak Dapat Diproses"}
      </p>
      <p className="mt-3 text-base font-medium text-[#5f302b]">{result.message}</p>
    </div>
  );
}
