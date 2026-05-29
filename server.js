const express = require("express");
const cors = require("cors");
const yts = require("yt-search");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { spawn } = require("child_process");

const app = express();

app.use(cors());

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

const TEMP_DIR = path.join(os.tmpdir(), "fleves_music");

if (!fs.existsSync(TEMP_DIR)) {

    fs.mkdirSync(TEMP_DIR, {
        recursive: true
    });

}

const isWindows = process.platform === "win32";

const ytDlpCommand = isWindows

    ? path.join(__dirname, "bin", "yt-dlp.exe")

    : "python3";

// PESQUISA
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
                thumbnail: v.thumbnail,
                duration: v.timestamp,
                views: v.views,
                url: v.url,
                author: v.author.name

            }));

        res.json(songs);

    } catch (err) {

        console.log(err);

        res.status(500).json({
            error: "Erro pesquisa"
        });

    }

});

// STREAM
app.get("/api/stream", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {

            return res.status(400).send("URL inválida");

        }

        const output = path.join(
            TEMP_DIR,
            `stream-${Date.now()}.mp3`
        );

        const args = isWindows

            ? [
                "--no-playlist",
                "-x",
                "--audio-format",
                "mp3",
                "-o",
                output,
                url
            ]

            : [
                "-m",
                "yt_dlp",
                "--no-playlist",
                "-x",
                "--audio-format",
                "mp3",
                "-o",
                output,
                url
            ];

        const ytDlp = spawn(
            ytDlpCommand,
            args
        );

        ytDlp.stderr.on("data", data => {

            console.log(data.toString());

        });

        ytDlp.on("close", code => {

            if (code !== 0) {

                return res.status(500)
                    .send("Erro yt-dlp");

            }

            if (!fs.existsSync(output)) {

                return res.status(500)
                    .send("Arquivo não criado");

            }

            res.setHeader(
                "Content-Type",
                "audio/mpeg"
            );

            const stream = fs.createReadStream(output);

            stream.pipe(res);

            stream.on("close", () => {

                fs.unlink(output, () => { });

            });

        });

        ytDlp.on("error", err => {
            console.log("ERRO yt-dlp:", err);
        });

        ffmpeg.on("error", err => {
            console.log("ERRO ffmpeg:", err);
        });

    } catch (err) {

        console.log(err);

        res.status(500).send("Erro stream");

    }

});

// DOWNLOAD
app.get("/api/download", async (req, res) => {

    try {

        const url = req.query.url;

        if (!url) {

            return res.status(400).send("URL inválida");

        }

        const output = path.join(
            TEMP_DIR,
            "%(uploader)s - %(title)s.%(ext)s"
        );

        const args = isWindows

            ? [
                "--no-playlist",
                "-x",
                "--audio-format",
                "mp3",
                "-o",
                output,
                url
            ]

            : [
                "-m",
                "yt_dlp",
                "--no-playlist",
                "-x",
                "--audio-format",
                "mp3",
                "-o",
                output,
                url
            ];

        const ytDlp = spawn(
            ytDlpCommand,
            args
        );

        ytDlp.stderr.on("data", data => {

            console.log(data.toString());

        });

        ytDlp.on("close", code => {

            if (code !== 0) {

                return res.status(500)
                    .send("Erro yt-dlp");

            }

            const files = fs.readdirSync(TEMP_DIR)
                .filter(f => f.endsWith(".mp3"));

            if (!files.length) {

                return res.status(500)
                    .send("MP3 não encontrado");

            }

            const latest = files
                .map(f => ({

                    file: f,
                    time: fs.statSync(
                        path.join(TEMP_DIR, f)
                    ).mtime.getTime()

                }))
                .sort((a, b) => b.time - a.time)[0];

            const filePath = path.join(
                TEMP_DIR,
                latest.file
            );

            res.download(
                filePath,
                latest.file,
                () => {

                    fs.unlink(filePath, () => { });

                }
            );

        });

    } catch (err) {

        console.log(err);

        res.status(500).send("Erro download");

    }

});

app.listen(PORT, () => {

    console.log(
        `🚀 Fleves Music: http://localhost:${PORT}`
    );

});
