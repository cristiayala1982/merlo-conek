package com.cristian1982.merloconec

import android.content.Intent
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HistoriasLabModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "HistoriasLabNative"
    }

    companion object {
        var promesaCamara: Promise? = null
    }

    @ReactMethod
    fun abrirCamaraHistorias(soloFoto: Boolean, esEspontanea: Boolean, promise: Promise) {
        promesaCamara = promise

        val intent = Intent(reactContext, HistoriasActivity::class.java)
        intent.putExtra("soloFoto", soloFoto)
        intent.putExtra("esEspontanea", esEspontanea)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun limpiarCacheNativo(promise: Promise) {
        try {
            val cacheDir = reactContext.cacheDir
            if (cacheDir.exists()) {
                cacheDir.deleteRecursively()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR_CACHE", e.message)
        }
    }

    @ReactMethod
    fun obtenerTamanoCache(promise: Promise) {
        try {
            val size = getDirSize(reactContext.cacheDir)
            promise.resolve(size.toDouble())
        } catch (e: Exception) {
            promise.reject("ERROR_SIZE", e.message)
        }
    }

    private fun getDirSize(dir: java.io.File): Long {
        var size: Long = 0
        val files = dir.listFiles()
        if (files != null) {
            for (file in files) {
                size += if (file.isDirectory) {
                    getDirSize(file)
                } else {
                    file.length()
                }
            }
        }
        return size
    }
}
