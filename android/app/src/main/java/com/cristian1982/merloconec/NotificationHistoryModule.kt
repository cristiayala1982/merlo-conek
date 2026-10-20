package com.cristian1982.merloconec

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
}
