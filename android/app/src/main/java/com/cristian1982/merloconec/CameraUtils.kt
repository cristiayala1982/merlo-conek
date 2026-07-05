package com.cristian1982.merloconec

import android.content.Context
import android.view.ScaleGestureDetector
import androidx.camera.core.Camera

object CameraUtils {

    fun configurarZoomGesto(context: Context, camera: Camera?): ScaleGestureDetector {
        return ScaleGestureDetector(context, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
            override fun onScale(detector: ScaleGestureDetector): Boolean {
                camera?.let {
                    val info = it.cameraInfo.zoomState.value
                    val currentZoomRatio = info?.zoomRatio ?: 1.0f
                    val delta = 1.0f + (detector.scaleFactor - 1.0f) * 2.5f
                    it.cameraControl.setZoomRatio(currentZoomRatio * delta)
                }
                return true
            }
        })
    }
}
