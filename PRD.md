# Product Requirements Document (PRD)

## Project

**WatchTogether**

## Overview

WatchTogether adalah aplikasi untuk berbagi layar (screen sharing)
secara real-time dengan fokus pada pengalaman "nonton bareng". Aplikasi
ditujukan untuk penggunaan personal dalam room kecil tanpa akun, tanpa
penyimpanan permanen, dan tanpa konfigurasi yang rumit.

## Goals

-   Screen sharing berkualitas tinggi dengan latensi rendah.
-   Pembuatan room yang cepat dan sederhana.
-   Tidak memerlukan akun maupun database.
-   Realtime untuk streaming dan chat.
-   Mudah digunakan oleh pengguna non-teknis.

## Non-Goals

-   Voice chat.
-   Webcam.
-   File sharing.
-   Screen sharing oleh viewer.
-   Recording.
-   Persistent chat/history.
-   User account, authentication, profile, atau friend list.

## Platform

### Desktop

-   Electron
-   Host & Viewer

### Web

-   Viewer only (mobile-first)

## Room

-   Room bersifat ephemeral (in-memory).
-   Maksimal 4 participant (termasuk host).
-   Room code terdiri dari 4 digit dengan pola dua pasang angka yang
    sama (contoh: 1122, 3344, 3300).
-   Room otomatis dibuat saat host memilih Create Room.
-   Room dihapus ketika participant terakhir keluar.

## Host

Host dapat: - Membuat room. - Share Entire Screen atau Window. - Share
system audio. - Menghentikan screen sharing. - Chat.

Jika host disconnect: - Room tetap aktif selama masih ada participant. -
Viewer melihat status "Waiting for Host". - Saat host reconnect
menggunakan room code yang sama, host kembali menjadi owner dan dapat
melanjutkan screen sharing.

## Viewer

Viewer dapat: - Join room menggunakan room code. - Memilih resolusi
sebelum mulai menonton. - Menonton stream. - Chat.

Viewer tidak dapat: - Share screen. - Share audio.

## Streaming

### Default

-   1920×1080
-   60 FPS

### Resolution Options

-   720p
-   1080p (Default)
-   1440p
-   Original

### Requirements

-   Hardware encoding digunakan jika tersedia.
-   Prioritas kualitas gambar dan keterbacaan teks.
-   Latency serendah mungkin.
-   Sinkronisasi host dan viewer harus secepat mungkin.

## Audio

-   System audio only.
-   Tidak mendukung microphone.

## Chat

-   Realtime.
-   Text.
-   Emoji.
-   Tidak mendukung gambar maupun file.
-   Temporary (hilang saat room dihapus).

## Connectivity

-   WebRTC.
-   Cloudflare Realtime TURN sebagai fallback.
-   WebSocket untuk signaling dan event realtime.

## Backend

Backend bertanggung jawab untuk: - Room management. - Signaling. - Chat
relay. - Presence. - Reconnect handling. - Health check.

Semua state disimpan di memory server.

Tidak menggunakan: - Database. - ORM. - Persistent storage.

## User Flow

### Host

1.  Buka aplikasi.
2.  Create Room.
3.  Room code dibuat otomatis.
4.  Pilih Entire Screen atau Window.
5.  Mulai screen sharing.
6.  Bagikan room code.

### Viewer

1.  Masukkan room code.
2.  Pilih resolusi.
3.  Klik Watch.
4.  Masuk ke room.
5.  Menonton dan chat.

## Realtime Requirements

Perubahan berikut harus terjadi secara realtime tanpa refresh: - Join
participant. - Leave participant. - Chat. - Screen sharing dimulai. -
Screen sharing dihentikan. - Host disconnect. - Host reconnect. - Status
room.

## Status

Status aplikasi meliputi: - Server Online - Server Offline -
Connecting - Connected - Waiting for Host - Watching - Sharing -
Reconnecting

## Success Criteria

-   Pembuatan room instan.
-   Join room dalam beberapa detik.
-   Streaming stabil pada 1080p60 jika kondisi jaringan memadai.
-   Chat realtime.
-   Tidak ada data yang tersimpan setelah room berakhir.
