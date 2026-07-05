package com.cristian1982.merloconec

import android.annotation.SuppressLint
import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Outline
import android.net.Uri
import android.os.Bundle
import android.os.CountDownTimer
import android.util.Log
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.ImageButton
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.Camera
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import android.media.MediaMetadataRetriever

class HistoriasActivity : AppCompatActivity() {

    companion object {
        private const val REQUEST_CAMERA_PERMISSIONS = 9001
    }

    private lateinit var viewFinder: PreviewView
    private lateinit var cameraExecutor: ExecutorService

    private lateinit var btnCapturarContenedor: View
    private lateinit var anilloExterior: View
    private lateinit var btnCapturar: View
    private lateinit var contenedorContador: LinearLayout
    private lateinit var txtTiempoGrabar: TextView
    private lateinit var btnVoltearCamara: ImageButton
    private lateinit var btnFlash: ImageButton
    private lateinit var btnGaleria: ImageButton

    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var scaleGestureDetector: ScaleGestureDetector? = null

    private var lensFacing = CameraSelector.LENS_FACING_BACK
    private var flashEncendido = false
    private var tiempoInicialToque: Long = 0
    private var estaGrabandoVideo = false
    private var temporizadorRegresivo: CountDownTimer? = null
    private var soloFotoMode = false

    private val selectorGaleriaLauncher = registerForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            if (esVideoMuyPesado(uri)) {
                Toast.makeText(this, "Solo videos HD (720p) o menores.", Toast.LENGTH_LONG).show()
            } else {
                cameraExecutor.execute {
                    val rutaLocal = copiarArchivoACache(uri)
                    runOnUiThread {
                        if (rutaLocal != null) {
                            HistoriasLabModule.promesaCamara?.resolve(rutaLocal)
                            HistoriasLabModule.promesaCamara = null
                            finish()
                        }
                    }
                }
            }
        }
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_historias)

        soloFotoMode = intent.getBooleanExtra("soloFoto", false)

        if (soloFotoMode) {
            findViewById<TextView>(R.id.txtInstruccion).text = "Toca para tomar foto de perfil"
        }

        viewFinder = findViewById(R.id.viewFinder)
        btnCapturarContenedor = findViewById(R.id.btnCapturarContenedor)
        anilloExterior = findViewById(R.id.anilloExterior)
        btnCapturar = findViewById(R.id.btnCapturar)
        contenedorContador = findViewById(R.id.contenedorContador)
        txtTiempoGrabar = findViewById(R.id.txtTiempoGrabar)
        btnVoltearCamara = findViewById(R.id.btnVoltearCamara)
        btnFlash = findViewById(R.id.btnFlash)
        btnGaleria = findViewById(R.id.btnGaleria)

        val outlineRedondo = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, view.width / 2f)
            }
        }
        anilloExterior.outlineProvider = outlineRedondo
        anilloExterior.clipToOutline = true
        btnCapturar.outlineProvider = outlineRedondo
        btnCapturar.clipToOutline = true

        btnVoltearCamara.clipToOutline = true
        btnFlash.clipToOutline = true
        btnGaleria.clipToOutline = true

        cameraExecutor = Executors.newSingleThreadExecutor()

        btnCapturar.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    tiempoInicialToque = System.currentTimeMillis()
                    v.isPressed = true
                    btnCapturarContenedor.animate().scaleX(1.15f).scaleY(1.15f).setDuration(150).start()
                    
                    if (!soloFotoMode) {
                        btnCapturar.postDelayed({
                            if (v.isPressed && !estaGrabandoVideo) {
                                startRecordingVideo()
                            }
                        }, 400)
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val duracionToque = System.currentTimeMillis() - tiempoInicialToque
                    v.isPressed = false
                    btnCapturarContenedor.animate().scaleX(1.0f).scaleY(1.0f).setDuration(150).start()
                    btnCapturar.animate().scaleX(1.0f).scaleY(1.0f).setDuration(150).start()

                    if (estaGrabandoVideo) {
                        stopRecordingVideo()
                    } else if (duracionToque < 400 && event.action == MotionEvent.ACTION_UP) {
                        takePhoto()
                    }
                    true
                }
                else -> false
            }
        }

        btnVoltearCamara.setOnClickListener {
            if (!estaGrabandoVideo) {
                lensFacing = if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                    CameraSelector.LENS_FACING_FRONT
                } else {
                    CameraSelector.LENS_FACING_BACK
                }
                flashEncendido = false
                btnFlash.setImageResource(android.R.drawable.btn_star_big_off)
                startCamera()
            }
        }

        btnFlash.setOnClickListener {
            if (lensFacing == CameraSelector.LENS_FACING_BACK) {
                flashEncendido = !flashEncendido
                camera?.cameraControl?.enableTorch(flashEncendido)
                if (flashEncendido) {
                    btnFlash.setImageResource(android.R.drawable.btn_star_big_on)
                } else {
                    btnFlash.setImageResource(android.R.drawable.btn_star_big_off)
                }
            }
        }

        btnGaleria.setOnClickListener {
            if (!estaGrabandoVideo) {
                btnGaleria.animate().scaleX(0.8f).scaleY(0.8f).setDuration(100).withEndAction {
                    btnGaleria.animate().scaleX(1.0f).scaleY(1.0f).setDuration(100).start()
                }.start()

                selectorGaleriaLauncher.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                )
            }
        }

        verificarPermisosYIniciarCamara()
    }

    private fun verificarPermisosYIniciarCamara() {
        if (tienePermisosBasicos()) {
            startCamera()
            return
        }

        ActivityCompat.requestPermissions(
            this,
            arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO),
            REQUEST_CAMERA_PERMISSIONS
        )
    }

    private fun tienePermisosBasicos(): Boolean {
        val cameraOk = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val audioOk = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        return cameraOk && audioOk
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider: ProcessCameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(viewFinder.surfaceProvider)
            }

            imageCapture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()

            val recorder = Recorder.Builder()
                .setQualitySelector(QualitySelector.from(Quality.HD))
                .build()
            videoCapture = VideoCapture.withOutput(recorder)

            val cameraSelector = CameraSelector.Builder().requireLensFacing(lensFacing).build()

            try {
                cameraProvider.unbindAll()
                camera = cameraProvider.bindToLifecycle(
                    this, cameraSelector, preview, imageCapture, videoCapture
                )
                scaleGestureDetector = CameraUtils.configurarZoomGesto(this, camera)
                viewFinder.setOnTouchListener { _, event ->
                    scaleGestureDetector?.onTouchEvent(event)
                    true
                }
            } catch (exc: Exception) {
                Log.e("HistoriasActivity", "Error al iniciar CameraX", exc)
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun takePhoto() {
        val imageCapture = imageCapture ?: return
        val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val photoFile = File(cacheDir, "$name.jpg")
        val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

        imageCapture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(this),
            object : ImageCapture.OnImageSavedCallback {
                override fun onError(exc: ImageCaptureException) {
                    Log.e("HistoriasActivity", "Error al capturar foto: ${exc.message}")
                    HistoriasLabModule.promesaCamara?.reject("ERROR_CAMARA", exc.message)
                }

                override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                    val pathCompleto = photoFile.absolutePath
                    HistoriasLabModule.promesaCamara?.resolve(pathCompleto)
                    HistoriasLabModule.promesaCamara = null
                    finish()
                }
            }
        )
    }

    @SuppressLint("MissingPermission")
    private fun startRecordingVideo() {
        val videoCapture = videoCapture ?: return
        estaGrabandoVideo = true

        btnCapturar.animate().scaleX(0.75f).scaleY(0.75f).setDuration(200).start()

        val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val videoFile = File(cacheDir, "$name.mp4")
        val outputOptions = FileOutputOptions.Builder(videoFile).build()

        val tieneAudio = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val recordingBuilder = videoCapture.output.prepareRecording(this, outputOptions)
        if (tieneAudio) {
            recordingBuilder.withAudioEnabled()
        }

        activeRecording = recordingBuilder
            .start(ContextCompat.getMainExecutor(this)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        iniciarCuentaRegresiva()
                    }
                    is VideoRecordEvent.Finalize -> {
                        cancelarCuentaRegresiva()
                        if (!recordEvent.hasError()) {
                            val pathCompleto = videoFile.absolutePath
                            HistoriasLabModule.promesaCamara?.resolve(pathCompleto)
                            HistoriasLabModule.promesaCamara = null
                            finish()
                        } else {
                            cleanupRecording()
                            HistoriasLabModule.promesaCamara?.reject("ERROR_VIDEO", "Error código: ${recordEvent.error}")
                        }
                    }
                }
            }
    }

    private fun iniciarCuentaRegresiva() {
        txtTiempoGrabar.setTextColor(ContextCompat.getColor(this, android.R.color.white))
        txtTiempoGrabar.text = "01:00"
        contenedorContador.visibility = View.VISIBLE

        temporizadorRegresivo = object : CountDownTimer(60000, 1000) {
            override fun onTick(millisUntilFinished: Long) {
                val segundosTotales = (millisUntilFinished / 1000).toInt()
                val minutos = segundosTotales / 60
                val segundos = segundosTotales % 60

                txtTiempoGrabar.text = String.format(Locale.US, "%02d:%02d", minutos, segundos)

                if (segundosTotales <= 5) {
                    txtTiempoGrabar.setTextColor(ContextCompat.getColor(this@HistoriasActivity, android.R.color.holo_red_light))
                }
            }

            override fun onFinish() {
                txtTiempoGrabar.text = "00:00"
                stopRecordingVideo()
            }
        }.start()
    }

    private fun cancelarCuentaRegresiva() {
        temporizadorRegresivo?.cancel()
        temporizadorRegresivo = null
        contenedorContador.visibility = View.GONE
    }

    private fun stopRecordingVideo() {
        if (estaGrabandoVideo) {
            estaGrabandoVideo = false
            cancelarCuentaRegresiva()
            activeRecording?.stop()
            activeRecording = null
        }
    }

    private fun cleanupRecording() {
        cancelarCuentaRegresiva()
        activeRecording?.close()
        activeRecording = null
        estaGrabandoVideo = false
    }

    private fun copiarArchivoACache(uri: Uri): String? {
        return try {
            val contenidoResolver = contentResolver
            val tipoMime = contenidoResolver.getType(uri) ?: ""
            val extension = if (tipoMime.contains("video")) "mp4" else "jpg"

            val nombreArchivo = "galeria_${System.currentTimeMillis()}.$extension"
            val archivoDestino = File(cacheDir, nombreArchivo)

            val inputStream: InputStream? = contenidoResolver.openInputStream(uri)
            val outputStream = FileOutputStream(archivoDestino)

            val buffer = ByteArray(4 * 1024)
            var bytesLeidos: Int
            while (inputStream?.read(buffer).also { bytesLeidos = it ?: -1 } != -1) {
                outputStream.write(buffer, 0, bytesLeidos)
            }

            outputStream.flush()
            outputStream.close()
            inputStream?.close()

            archivoDestino.absolutePath
        } catch (e: Exception) {
            Log.e("HistoriasActivity", "Error al clonar el archivo seleccionado", e)
            null
        }
    }

    private fun esVideoMuyPesado(uri: Uri): Boolean {
        return try {
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(this, uri)
            val width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
            retriever.release()
            width > 1280
        } catch (e: Exception) {
            false
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        cancelarCuentaRegresiva()
        cameraExecutor.shutdown()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != REQUEST_CAMERA_PERMISSIONS) return

        val concedidos = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        if (concedidos) {
            startCamera()
        } else {
            Toast.makeText(this, "Debes aceptar permisos de camara y microfono.", Toast.LENGTH_LONG).show()
            HistoriasLabModule.promesaCamara?.reject("PERMISOS_DENEGADOS", "Permisos de camara/microfono denegados")
            HistoriasLabModule.promesaCamara = null
            finish()
        }
    }
}
