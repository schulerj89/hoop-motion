# Pexels Sample Clips

HoopMotion `0.1.1` uses these real basketball clips for local validation:

| Run | Source | Local file | Notes |
| --- | --- | --- | --- |
| `pexels-5586522` | <https://www.pexels.com/video/man-playing-basketball-5586522/> | `data/input/pexels_basketball_5586522.mp4` | Strong detection sample: 150/150 frames detected. |
| `pexels-5192069` | <https://www.pexels.com/video/man-playing-basketball-5192069/> | `data/input/pexels_basketball_5192069.mp4` | Strong detection sample: 149/150 frames detected. |

The source MP4 files are downloaded with:

```powershell
npm run samples:download
```

The downloaded videos are ignored by git. Viewer-ready derived outputs are committed in `public/runs/<run>/`.
