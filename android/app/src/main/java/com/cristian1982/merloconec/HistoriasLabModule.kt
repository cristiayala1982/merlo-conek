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
    fun abrirCamaraHistorias(soloFoto: Boolean, promise: Promise) {
        promesaCamara = promise

        val intent = Intent(reactContext, HistoriasActivity::class.java)
        intent.putExtra("soloFoto", soloFoto)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }
}
