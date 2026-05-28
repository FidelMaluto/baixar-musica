const express = require("express");
const cors = require("cors");
const yts = require("yt-search");
const path = require("path");
const fs = require("fs");

const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.static("./public"));

const PORT = process.env.PORT || 3000;

/*
========================================
DETECTAR SISTEMA OPERACIONAL
========================================
*/

const isWindows = process.platform === "win32";

/*
========================================
CAMINHOS
========================================
*/

const ffmpegPath = isWindows
    ? path.join(__dirname, "bin", "ffmpeg.exe")
    : "ffmpeg";

const ffprobePath = isWindows
    ? path.join(__dirname, "bin", "ffprobe.exe")
    : "ffprobe";

const ytDlpPath = isWindows
    ? path.join(__dirname, "bin", "yt-dlp.exe")
    : "yt-dlp";

process.env.FFMPEG_PATH = ffmpegPath;
process.env.FFPROBE_PATH = ffprobePath;
/*
========================================
VERIFICAR BINÁRIOS
========================================
*/

if (isWindows) {

    if (!fs.existsSync(ytDlpPath)) {
        console.log("❌ yt-dlp.exe não encontrado");
    }

    if (!fs.existsSync(ffmpegPath)) {
        console.log("❌ ffmpeg.exe não encontrado");
    }

}

console.log("YT-DLP:", ytDlpPath);
console.log("FFMPEG:", ffmpegPath);

/*
========================================
PESQUISA
========================================
*/

app.get("/api/search", async (req, res) => {

    try {

        const q = req.query.q;

        if (!q) {
            return res.json([]);
        }

        const result = await yts(q);

        const songs = result.videos
            .slice(0, 20)
            .map(v => ({
                title: v.title,
                duration: v.timestamp,
                views: v.views,
                thumbnail: v.thumbnail,
                url: v.url,
                author: v.author.name
            }));

        res.json(songs);

    }

    catch (err) {

        console.log(err);

        res.status(500).json({
            error: "Erro na pesquisa"
        });

    }

});

/*
========================================
STREAM
========================================
*/

app.get("/api/stream", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        res.setHeader("Content-Type", "audio/mpeg");

        /*
        ================================
        YT-DLP
        ================================
        */

        const ytDlp = spawn(
            ytDlpPath,
            [
                "--no-playlist",
                "-f",
                "bestaudio",
                "-o",
                "-",
                url
            ]
        );

        const ffmpeg = spawn(
            ffmpegPath,
            [
                "-i",
                "pipe:0",
                "-f",
                "mp3",
                "-ab",
                "192k",
                "pipe:1"
            ]
        );
        /*
        ================================
        PIPE
        ================================
        */

        ytDlp.stdout.pipe(ffmpeg.stdin);

        ffmpeg.stdout.pipe(res);

        /*
        ================================
        LOGS
        ================================
        */

        ytDlp.stderr.on("data", data => {
            console.log("yt-dlp:", data.toString());
        });

        ffmpeg.stderr.on("data", data => {
            console.log("ffmpeg:", data.toString());
        });

        /*
        ================================
        ERROS
        ================================
        */

        ytDlp.on("error", err => {
            console.log("Erro yt-dlp:", err);
        });

        ffmpeg.on("error", err => {
            console.log("Erro ffmpeg:", err);
        });

        ytDlp.on("close", code => {
            console.log("yt-dlp fechado:", code);
        });

        ffmpeg.on("close", code => {
            console.log("ffmpeg fechado:", code);
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).send("Erro stream");

    }

});

/*
========================================
DOWNLOAD
========================================
*/

app.get("/api/download", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        /*
        ================================
        PEGAR TÍTULO
        ================================
        */

        const getTitulo = spawn(
            ytDlpPath,
            [
                "--print",
                "%(uploader)s - %(title)s",
                url
            ]
        );

        let musicaNome = "";

        getTitulo.stdout.on("data", data => {
            musicaNome += data.toString();
        });

        getTitulo.on("close", () => {

            /*
            ================================
            LIMPAR NOME
            ================================
            */

            musicaNome = musicaNome
                .trim()

                .replace(/[\\/:*?"<>|]/g, "")

                .replace(/[\u{1F600}-\u{1F6FF}]/gu, "")

                .replace(/[^\w\s.-]/gi, "")

                .substring(0, 120);

            if (!musicaNome) {
                musicaNome = "Fleves_Music";
            }

            /*
            ================================
            HEADERS
            ================================
            */

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${musicaNome}.mp3"`
            );

            res.setHeader(
                "Content-Type",
                "audio/mpeg"
            );

            /*
            ================================
            DOWNLOAD
            ================================
            */

            const ytDlp = spawn(
                ytDlpPath,
                [
                    "-x",

                    "--audio-format",
                    "mp3",

                    "--audio-quality",
                    "0",

                    "-o",
                    "-",

                    url
                ]
            );

            ytDlp.stdout.pipe(res);

            ytDlp.stderr.on("data", data => {
                console.log("yt-dlp download:", data.toString());
            });

            ytDlp.on("error", err => {
                console.log("Erro yt-dlp:", err);
            });

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).send("Erro download");

    }

});

/*
========================================
SERVER
========================================
*/

app.listen(PORT, () => {

    console.log(`🚀 Fleves Music: http://localhost:${PORT}`);

});
