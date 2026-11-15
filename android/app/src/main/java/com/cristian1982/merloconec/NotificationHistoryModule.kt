package com.cristian1982.merloconec

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotificationHistoryModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "NotificationHistoryModule"
    }

    @ReactMethod
    fun clearChatHistory(chatId: String) {
        MyFirebaseMessagingService.clearHistoryForChat(chatId)
    }

    @ReactMethod
    fun clearSocialNotifications() {
        val notificationManager = reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.cancelAll() // Limpia la barra de notificaciones completa
    }

    @ReactMethod
    fun setActiveChat(chatId: String?) {
        MyFirebaseMessagingService.setActiveChat(chatId)
    }
}
