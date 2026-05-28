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

        const args = [
            "--no-playlist",
            "-f",
            "bestaudio",
            "--extract-audio",
            "--audio-format",
            "mp3",
            "-o",
            "-",
            url
        ];

        const ytDlp = process.platform === "win32"

            ? spawn(
                path.join(__dirname, "bin", "yt-dlp.exe"),
                args
            )

            : spawn(
                "python3",
                ["-m", "yt_dlp", ...args]
            );

        res.setHeader("Content-Type", "audio/mpeg");

        ytDlp.stdout.pipe(res);

        ytDlp.stderr.on("data", data => {

            console.log("yt-dlp:", data.toString());

        });

        ytDlp.on("close", code => {

            console.log("yt-dlp fechou:", code);

        });

    } catch (err) {

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

        const argsInfo = [
            "--print",
            "%(uploader)s - %(title)s",
            url
        ];

        const getTitulo = process.platform === "win32"

            ? spawn(
                path.join(__dirname, "bin", "yt-dlp.exe"),
                argsInfo
            )

            : spawn(
                "python3",
                ["-m", "yt_dlp", ...argsInfo]
            );

        let musicaNome = "";

        getTitulo.stdout.on("data", data => {

            musicaNome += data.toString();

        });

        getTitulo.on("close", () => {

            musicaNome = musicaNome
                .trim()
                .replace(/[\\/:*?"<>|]/g, "")
                .replace(/[^\w\s.-]/gi, "")
                .substring(0, 100);

            if (!musicaNome) {

                musicaNome = "FlevesMusic";

            }

            res.setHeader(
                "Content-Disposition",
                `attachment; filename="${musicaNome}.mp3"`
            );

            res.setHeader(
                "Content-Type",
                "audio/mpeg"
            );

            const argsDownload = [
                "--no-playlist",
                "-f",
                "bestaudio",
                "--extract-audio",
                "--audio-format",
                "mp3",
                "-o",
                "-",
                url
            ];

            const ytDlp = process.platform === "win32"

                ? spawn(
                    path.join(__dirname, "bin", "yt-dlp.exe"),
                    argsDownload
                )

                : spawn(
                    "python3",
                    ["-m", "yt_dlp", ...argsDownload]
                );

            ytDlp.stdout.pipe(res);

            ytDlp.stderr.on("data", data => {

                console.log("yt-dlp erro:", data.toString());

            });

        });

    } catch (err) {

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
