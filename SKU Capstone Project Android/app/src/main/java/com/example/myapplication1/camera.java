package com.example.myapplication1;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Bundle;
import android.util.Log;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import java.net.DatagramPacket;
import java.net.DatagramSocket;

public class camera extends AppCompatActivity {

    // 💡 클래스 멤버 변수로 선언해야 onCreate 내부에서 빨간 줄이 안 뜬다!
    private ImageView videoView;
    private TextView statusText;
    private DatagramSocket udpSocket;
    private boolean isStreaming = true;
    private final int UDP_PORT = 5005;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_camera);

        // 1. UI 컴포넌트 초기화 (XML의 ID와 일치시켜라)
        videoView = findViewById(R.id.videoView);
        statusText = findViewById(R.id.statusText);

        // 2. 시스템 바 인셋 설정 (main ID를 XML 최상단에 넣었다)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main), (v, insets) -> {
            Insets systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom);
            return insets;
        });

        // 3. 실시간 영상 수신 스레드 시작
        startVideoStreaming();
    }

    private void startVideoStreaming() {
        new Thread(() -> {
            try {
                udpSocket = new DatagramSocket(UDP_PORT);
                byte[] buffer = new byte[65535];
                while (isStreaming) {
                    DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                    udpSocket.receive(packet);

                    Bitmap bitmap = BitmapFactory.decodeByteArray(packet.getData(), 0, packet.getLength());
                    if (bitmap != null) {
                        runOnUiThread(() -> {
                            videoView.setImageBitmap(bitmap);
                            statusText.setText("Live Streaming");
                        });
                    }
                }
            } catch (Exception e) {
                Log.e("UDP_STREAM", e.getMessage());
            } finally {
                if (udpSocket != null) udpSocket.close();
            }
        }).start();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        isStreaming = false;
        if (udpSocket != null) udpSocket.close();
    }
}