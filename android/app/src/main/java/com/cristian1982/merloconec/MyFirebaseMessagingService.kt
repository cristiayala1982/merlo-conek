package com.cristian1982.merloconec

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.graphics.drawable.IconCompat
import com.bumptech.glide.Glide
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import org.json.JSONObject

class MyFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private val messageHistory = mutableMapOf<String, MutableList<NotificationCompat.MessagingStyle.Message>>()
        private var activeChatId: String? = null

        // Función estática para que JavaScript pueda borrar la memoria de un chat
        fun clearHistoryForChat(chatId: String) {
            messageHistory.remove(chatId)
            Log.d("KOTLIN_PUSH", "🧹 Memoria limpiada para el chat: $chatId")
        }

        fun setActiveChat(chatId: String?) {
            activeChatId = chatId
            Log.d("KOTLIN_PUSH", "📍 Chat activo: $chatId")
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d("KOTLIN_PUSH", "🚀 Mensaje recibido")

        val data = remoteMessage.data
        val chatIdFromData = data["chatId"] ?: "default"

        // SILENCIO INTELIGENTE: Si el chat está abierto, no notificamos
        if (activeChatId != null && activeChatId == chatIdFromData) {
            Log.d("KOTLIN_PUSH", "🔇 Chat activo detectado. Ignorando notificación.")
            return
        }

        var title = "Merlo Conek"
        var body = ""
        var chatId = "default"
        var deUserId = ""
        var deFoto = ""
        var tipoMensaje = "texto"
        var chatTipo = "regular"
        var productId = ""
        var pushType = data["type"] ?: "chat"
        var tipoNotif = data["tipoNotif"] ?: ""
        var postId = data["postId"] ?: ""

        try {
            if (data.containsKey("title")) {
                title = data["title"] ?: title
                body = data["body"] ?: ""
                chatId = data["chatId"] ?: chatId
                deUserId = data["deUserId"] ?: ""
                deFoto = data["deFoto"] ?: ""
                tipoMensaje = data["tipoMensaje"] ?: "texto"
                chatTipo = data["chatTipo"] ?: "regular"
                productId = data["productId"] ?: ""
                pushType = data["type"] ?: pushType
                tipoNotif = data["tipoNotif"] ?: tipoNotif
                postId = data["postId"] ?: postId
            } else if (data.containsKey("body") && data["body"]?.startsWith("{") == true) {
                val json = JSONObject(data["body"])
                title = json.optString("title", title)
                body = json.optString("body", "")
                chatId = json.optString("chatId", chatId)
                deUserId = json.optString("deUserId", "")
                deFoto = json.optString("deFoto", "")
                tipoMensaje = json.optString("tipoMensaje", "texto")
                chatTipo = json.optString("chatTipo", "regular")
                productId = json.optString("productId", "")
                pushType = json.optString("type", pushType)
                tipoNotif = json.optString("tipoNotif", tipoNotif)
                postId = json.optString("postId", postId)
            }

            Log.d("KOTLIN_PUSH", "📸 Tipo Push: $pushType | Tipo Mensaje: $tipoMensaje | Chat: $chatTipo")

            val bitmap = if (deFoto.isNotEmpty() && deFoto.startsWith("http")) {
                try {
                    Glide.with(applicationContext)
                        .asBitmap()
                        .load(deFoto)
                        .circleCrop()
                        .submit(200, 200)
                        .get()
                } catch (e: Exception) { 
                    null 
                }
            } else null

            if (pushType == "social") {
                sendSocialNotification(title, body, tipoNotif, postId, bitmap)
            } else {
                sendMessagingNotification(title, body, chatId, deUserId, bitmap, tipoMensaje, chatTipo, productId)
            }

        } catch (e: Exception) {
            Log.e("KOTLIN_PUSH", "❌ Error: ${e.message}")
        }
    }

    private fun sendSocialNotification(title: String, message: String, tipo: String, postId: String, userBitmap: Bitmap?) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "social_notifications_v1"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Interacciones Sociales", NotificationManager.IMPORTANCE_DEFAULT).apply {
                lightColor = Color.parseColor("#FF6600")
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Deep Link SEGURO a la Campanita
        val deepLinkUrl = "merloconec://notificaciones?t=${System.currentTimeMillis()}"
        
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUrl)).apply {
            setPackage(packageName)
            // Banderas para limpiar el historial y asegurar que abra la campanita
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

        // RequestCode fijo para lo social para que NO se amontonen
        val requestCodeSocial = 999
        val pendingIntent = PendingIntent.getActivity(
            this, requestCodeSocial, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(resources.getIdentifier("ic_stat_notifications", "drawable", packageName))
            .setContentTitle(title)
            .setContentText(message)
            .setColor(Color.parseColor("#FF6600"))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)

        if (userBitmap != null) {
            builder.setLargeIcon(userBitmap)
        }

        // Usamos ID 999 fijo: la nueva notificación REEMPLAZA a la anterior.
        // ¡Adiós al amontonamiento!
        notificationManager.notify(requestCodeSocial, builder.build())
    }

    private fun sendMessagingNotification(senderName: String, messageText: String, chatId: String, deUserId: String, userBitmap: Bitmap?, tipoMensaje: String, chatTipo: String, productId: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "chats_nativos_v7"

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(channelId, "Mensajes de Merlo Conek", NotificationManager.IMPORTANCE_HIGH).apply {
                lightColor = Color.parseColor("#FF6600")
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Deep Link mejorado: merloconec://chats?userId=...&tipo=market&productId=...
        var deepLinkUrl = "merloconec://chats?userId=$deUserId"
        if (chatTipo == "market") {
            deepLinkUrl += "&tipo=market"
            if (productId.isNotEmpty()) {
                deepLinkUrl += "&productId=$productId"
            }
        }
        
        val deepLinkUri = Uri.parse(deepLinkUrl)
        val intent = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
            setPackage(packageName)
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, Math.abs(chatId.hashCode()), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val personBuilder = Person.Builder().setName(senderName)
        if (userBitmap != null) {
            personBuilder.setIcon(IconCompat.createWithBitmap(userBitmap))
        }
        val user = personBuilder.build()

        val newMessage = NotificationCompat.MessagingStyle.Message(messageText, System.currentTimeMillis(), user)
        val history = messageHistory.getOrPut(chatId) { mutableListOf() }
        history.add(newMessage)
        if (history.size > 5) history.removeAt(0)

        val style = NotificationCompat.MessagingStyle(Person.Builder().setName("Yo").build())
            .setConversationTitle(senderName)
            .setGroupConversation(false)

        for (msg in history) {
            style.addMessage(msg)
        }

        val notificationId = Math.abs(chatId.hashCode())
        
        // Determinar icono pequeño y ticker basado en el tipo de mensaje
        val iconResName = "ic_stat_notifications"
        
        // Ajustar el comportamiento si es una reacción o respuesta
        val esReaccion = tipoMensaje == "reaccion"
        val esRespuesta = tipoMensaje == "respuesta"

        Log.d("KOTLIN_PUSH", "🔔 Procesando Notificación: ID=$notificationId | Tipo=$tipoMensaje | Reaccion=$esReaccion | Respuesta=$esRespuesta")

        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(resources.getIdentifier(iconResName, "drawable", packageName))
            .setColor(Color.parseColor("#FF6600"))
            .setStyle(style)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH) // Subimos prioridad para asegurar visibilidad
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setGroup("com.merlo_conek.CHAT_GROUP")
            .setTicker(messageText)

        if (esReaccion) {
            // Vibración sutil para reacciones
            builder.setVibrate(longArrayOf(0, 100)) 
        } else if (esRespuesta) {
            // Vibración doble para respuestas
            builder.setVibrate(longArrayOf(0, 250, 200, 250))
        }

        notificationManager.notify(notificationId, builder.build())
        Log.d("KOTLIN_PUSH", "✅ Notificación enviada al sistema")
    }
}
