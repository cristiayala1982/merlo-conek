package com.cristian1982.merloconec

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        
        Log.d("KOTLIN_PUSH", "🚀 Mensaje recibido de: ${remoteMessage.from}")

        // Extraer datos del mensaje
        val data = remoteMessage.data
        val title = data["title"] ?: remoteMessage.notification?.title ?: "Nuevo mensaje"
        val body = data["body"] ?: remoteMessage.notification?.body ?: ""
        val chatId = data["chatId"] ?: "default_chat"
        val deUserId = data["deUserId"] ?: ""

        sendNotification(title, body, chatId, deUserId)
    }

    private fun sendNotification(title: String, body: String, chatId: String, deUserId: String) {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "chats_nativos"

        // Crear canal para Android 8+
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Mensajes de Chat",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notificaciones de chats de Merlo Conek"
                enableLights(true)
                lightColor = Color.parseColor("#FF6600")
                enableVibration(true)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // Intent para abrir la app al tocar (Deep Linking)
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra("chatId", chatId)
            putExtra("deUserId", deUserId)
            putExtra("type", "chat")
        }
        
        val pendingIntent = PendingIntent.getActivity(
            this, chatId.hashCode(), intent,
            PendingIntent.FLAG_ONE_SHOT or PendingIntent.FLAG_IMMUTABLE
        )

        // Construir la notificación con ID FIJO por chatId
        // Esto obliga a Android a juntar los mensajes de la misma persona
        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(resources.getIdentifier("ic_stat_notifications", "drawable", packageName))
            .setColor(Color.parseColor("#FF6600"))
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(pendingIntent)
            .setGroup(chatId) // Agrupar por chat
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_SUMMARY)

        // Usar hashCode del chatId como ID de la notificación para sobreescritura
        val notificationId = Math.abs(chatId.hashCode())
        notificationManager.notify(notificationId, notificationBuilder.build())
        
        Log.d("KOTLIN_PUSH", "✅ Burbuja dibujada para: $chatId con ID: $notificationId")
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("KOTLIN_PUSH", "🆕 Nuevo Token generado: $token")
    }
}
