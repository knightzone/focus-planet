package uts.focusdetector.android

import android.graphics.Bitmap
import android.graphics.Matrix
import android.graphics.PointF
import android.media.FaceDetector
import org.json.JSONObject
import java.nio.ByteBuffer
import kotlin.math.max
import kotlin.math.roundToInt

object FocusFaceDetectorNative {
    private data class Detection(
        val faceCount: Int,
        val faceScale: Float,
        val centerX: Float,
        val centerY: Float,
        val yaw: Float,
        val roll: Float,
        val pitch: Float,
        val confidence: Float,
        val score: Float
    )

    fun detectRgba(rgba: ByteBuffer, width: Int, height: Int): String {
        try {
            if (width < 2 || height < 2 || rgba.remaining() < width * height * 4) {
                return result(false, false, 0, 0f, 0.5f, 0.5f, 0f, 0f, 0f, 0f, "相机帧尺寸无效")
            }
            rgba.rewind()
            val bytes = ByteArray(width * height * 4)
            rgba.get(bytes)
            val pixels = IntArray(width * height)
            for (index in pixels.indices) {
                val offset = index * 4
                val red = bytes[offset].toInt() and 0xff
                val green = bytes[offset + 1].toInt() and 0xff
                val blue = bytes[offset + 2].toInt() and 0xff
                val alpha = bytes[offset + 3].toInt() and 0xff
                pixels[index] = (alpha shl 24) or (red shl 16) or (green shl 8) or blue
            }
            val source = Bitmap.createBitmap(pixels, width, height, Bitmap.Config.ARGB_8888)
            val maxWidth = 480
            val scale = if (width > maxWidth) maxWidth.toFloat() / width.toFloat() else 1f
            var targetWidth = max(2, (width * scale).roundToInt())
            if (targetWidth % 2 != 0) targetWidth -= 1
            var targetHeight = max(2, (height * targetWidth.toFloat() / width.toFloat()).roundToInt())
            if (targetHeight % 2 != 0) targetHeight -= 1
            val scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
            val rgb565 = scaled.copy(Bitmap.Config.RGB_565, false)
            val rotated90 = rotate(rgb565, 90f)
            val rotated180 = rotate(rgb565, 180f)
            val rotated270 = rotate(rgb565, 270f)
            val best = listOf(rgb565, rotated90, rotated180, rotated270)
                .mapNotNull { detectFace(it) }
                .maxByOrNull { it.score }
            recycle(source, scaled, rgb565, rotated90, rotated180, rotated270)
            if (best == null) {
                return result(true, false, 0, 0f, 0.5f, 0.5f, 0f, 0f, 0f, 0f, "")
            }
            return result(true, true, best.faceCount, best.faceScale, best.centerX, best.centerY, best.yaw, best.roll, best.pitch, best.confidence, "")
        } catch (error: Throwable) {
            return result(false, false, 0, 0f, 0.5f, 0.5f, 0f, 0f, 0f, 0f, error.message ?: "Android 端侧检测失败")
        }
    }

    private fun rotate(bitmap: Bitmap, degrees: Float): Bitmap {
        val matrix = Matrix()
        matrix.postRotate(degrees)
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, false)
    }

    private fun detectFace(bitmap: Bitmap): Detection? {
        val faces = arrayOfNulls<FaceDetector.Face>(3)
        val faceCount = FaceDetector(bitmap.width, bitmap.height, faces.size).findFaces(bitmap, faces)
        val primary = faces.filterNotNull().maxByOrNull { it.eyesDistance() } ?: return null
        val midpoint = PointF()
        primary.getMidPoint(midpoint)
        val confidence = primary.confidence()
        return Detection(
            faceCount = faceCount,
            faceScale = (primary.eyesDistance() * 2.2f / bitmap.width.toFloat()).coerceIn(0f, 1f),
            centerX = (midpoint.x / bitmap.width.toFloat()).coerceIn(0f, 1f),
            centerY = (midpoint.y / bitmap.height.toFloat()).coerceIn(0f, 1f),
            yaw = primary.pose(FaceDetector.Face.EULER_Y),
            roll = primary.pose(FaceDetector.Face.EULER_Z),
            pitch = primary.pose(FaceDetector.Face.EULER_X),
            confidence = confidence,
            score = primary.eyesDistance() * max(0.1f, confidence)
        )
    }

    private fun recycle(vararg bitmaps: Bitmap) {
        val recycled = HashSet<Bitmap>()
        bitmaps.forEach { bitmap ->
            if (recycled.add(bitmap) && !bitmap.isRecycled) bitmap.recycle()
        }
    }

    private fun result(
        supported: Boolean,
        detected: Boolean,
        faceCount: Int,
        faceScale: Float,
        centerX: Float,
        centerY: Float,
        yaw: Float,
        roll: Float,
        pitch: Float,
        confidence: Float,
        errorMessage: String
    ): String {
        return JSONObject()
            .put("supported", supported)
            .put("detected", detected)
            .put("faceCount", faceCount)
            .put("faceScale", faceScale.toDouble())
            .put("centerX", centerX.toDouble())
            .put("centerY", centerY.toDouble())
            .put("yaw", yaw.toDouble())
            .put("roll", roll.toDouble())
            .put("pitch", pitch.toDouble())
            .put("confidence", confidence.toDouble())
            .put("errorMessage", errorMessage)
            .toString()
    }
}
