package com.example.myapplication1;

import android.os.Bundle;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.media3.common.MediaItem;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.ui.PlayerView;

public class camera extends AppCompatActivity {

    private ExoPlayer player;
    private TextView statusText;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_camera);

        // 1. UI 컴포넌트 초기화
        statusText = findViewById(R.id.statusText);
        PlayerView playerView = findViewById(R.id.playerView);

        // 2. ExoPlayer 빌더를 사용하여 플레이어 초기화 (규진님 방식)
        player = new ExoPlayer.Builder(this).build();
        playerView.setPlayer(player);

        // 3. 미디어 아이템 설정 (HLS 스트리밍 주소)
        // 10.0.2.2는 안드로이드 에뮬레이터에서 로컬 호스트 PC를 가리키는 주소입니다.
        MediaItem mediaItem = MediaItem.fromUri("http://10.0.2.2:3001/stream/streamingfile.m3u8");

        player.setMediaItem(mediaItem);
        player.prepare(); // 재생 준비
        player.play();    // 재생 시작

        statusText.setText("Live Streaming");
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // 4. 액티비티 종료 시 플레이어 리소스 해제 (메모리 누수 방지 필수)
        if (player != null) {
            player.release();
            player = null;
        }
    }
}