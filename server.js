const express = require("express");
const cors = require("cors");
const yts = require("yt-search");
const path = require("path");
const fs = require("fs");
const os = require("os");
const rateLimit = require("express-rate-limit");

const { spawn } = require("child_process");

const app = express();

app.use(cors());
app.use(express.static("public"));

const PORT = process.env.PORT || 3100;

// LIMITADOR GERAL (pesquisa) - mais permissivo
const searchLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 30, // 30 pesquisas por minuto por IP
    message: { error: "Demasiadas pesquisas. Tenta novamente em instantes." },
    standardHeaders: true,
    legacyHeaders: false,
});

// LIMITADOR PARA STREAM/DOWNLOAD - mais restritivo (operações caras)
const heavyLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 stream/downloads por minuto por IP
    message: { error: "Limite de reproduções/downloads atingido. Aguarda um pouco." },
    standardHeaders: true,
    legacyHeaders: false,
});

// PESQUISA
app.get("/api/search", searchLimiter, async (req, res) => {
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
app.get("/api/stream", heavyLimiter, async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        const videoId = getVideoId(url);

        if (!videoId) {
            return res.status(400).send("URL do YouTube inválida");
        }

        const cachePath = getCachePath(videoId);

        res.setHeader("Content-Type", "audio/mpeg");

        // JÁ EM CACHE -> serve direto do disco
        if (fs.existsSync(cachePath)) {
            console.log(`Cache HIT: ${videoId}`);
            return fs.createReadStream(cachePath).pipe(res);
        }

        console.log(`Cache MISS: ${videoId} - processando...`);

        const ytDlpPath = path.join(__dirname, "bin", "yt-dlp.exe");
        const ffmpegPath = path.join(__dirname, "bin", "ffmpeg.exe");

        const ytDlp = spawn(ytDlpPath, ["--no-playlist", "-f", "bestaudio", "-o", "-", url]);
        const ffmpeg = spawn(ffmpegPath, ["-i", "pipe:0", "-f", "mp3", "-ab", "192k", "pipe:1"]);

        ytDlp.stdout.pipe(ffmpeg.stdin);

        // Grava em cache (ficheiro temporário primeiro, evita cache corrompido se falhar a meio)
        const tempPath = `${cachePath}.tmp`;
        const cacheWriteStream = fs.createWriteStream(tempPath);

        ffmpeg.stdout.pipe(res);
        ffmpeg.stdout.pipe(cacheWriteStream);

        ffmpeg.on("close", (code) => {
            cacheWriteStream.end();

            if (code === 0) {
                // Sucesso -> renomeia de .tmp para definitivo
                fs.rename(tempPath, cachePath, (err) => {
                    if (err) console.log("Erro ao finalizar cache:", err);
                    else console.log(`Cache salvo: ${videoId}`);
                });
            } else {
                // Falhou -> remove o ficheiro temporário incompleto
                fs.unlink(tempPath, () => {});
            }
        });

        ytDlp.stderr.on("data", data => {
            console.log("yt-dlp:", data.toString());
        });

        ffmpeg.stderr.on("data", data => {
            console.log("ffmpeg:", data.toString());
        });

        req.on("close", () => {
            ytDlp.kill();
            ffmpeg.kill();
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Erro stream");
    }
});

// DOWNLOAD
app.get("/api/download", heavyLimiter, async (req, res) => {
    try {
        const url = req.query.url;

        if (!url) {
            return res.status(400).send("URL inválida");
        }

        const videoId = getVideoId(url);

        if (!videoId) {
            return res.status(400).send("URL do YouTube inválida");
        }

        const cachePath = getCachePath(videoId);
        const ytDlpPath = path.join(__dirname, "bin", "yt-dlp.exe");

        const getTitulo = spawn(ytDlpPath, ["--print", "%(uploader)s - %(title)s", url]);

        let musicaNome = "";
        getTitulo.stdout.on("data", data => {
            musicaNome += data.toString();
        });

        getTitulo.on("close", () => {
            musicaNome = musicaNome
                .trim()
                .replace(/[\\/:*?"<>|]/g, "")
                .replace(/[^\w\s.-]/gi, "")
                .substring(0, 120);

            if (!musicaNome) {
                musicaNome = "Fleves_Music";
            }

            res.setHeader("Content-Disposition", `attachment; filename="${musicaNome}.mp3"`);
            res.setHeader("Content-Type", "audio/mpeg");

            // JÁ EM CACHE -> serve direto
            if (fs.existsSync(cachePath)) {
                console.log(`Cache HIT (download): ${videoId}`);
                return fs.createReadStream(cachePath).pipe(res);
            }

            console.log(`Cache MISS (download): ${videoId} - processando...`);

            const tempPath = `${cachePath}.tmp`;
            const cacheWriteStream = fs.createWriteStream(tempPath);

            const ytDlp = spawn(ytDlpPath, ["-x", "--audio-format", "mp3", "-o", "-", url]);

            ytDlp.stdout.pipe(res);
            ytDlp.stdout.pipe(cacheWriteStream);

            ytDlp.on("close", (code) => {
                cacheWriteStream.end();

                if (code === 0) {
                    fs.rename(tempPath, cachePath, (err) => {
                        if (err) console.log("Erro ao finalizar cache:", err);
                    });
                } else {
                    fs.unlink(tempPath, () => {});
                }
            });

            ytDlp.stderr.on("data", data => {
                console.log("yt-dlp erro:", data.toString());
            });

            req.on("close", () => {
                ytDlp.kill();
            });
        });

    } catch (err) {
        console.log(err);
        res.status(500).send("Erro download");
    }
});

// Listing
app.listen(PORT, () => {
    console.log(`Fleves Music: http://localhost:${PORT}`);
});
