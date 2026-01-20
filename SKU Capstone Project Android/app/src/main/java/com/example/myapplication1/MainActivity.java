package com.example.myapplication1;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class MainActivity extends AppCompatActivity {

    EditText etId, etPassword;
    ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        etId = findViewById(R.id.et_id);
        etPassword = findViewById(R.id.et_password);

        Button btnLogin = findViewById(R.id.btn_login);
        View btnSignup = findViewById(R.id.btn_signup);

        // 🔽 여기 추가: "아이디 또는 비밀번호를 잊으셨나요?" TextView
        TextView tvFindAccount = findViewById(R.id.tv_find_account);

        // API 설정 (지금은 안 써도 남겨둬도 됨)
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3000/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        apiService = retrofit.create(ApiService.class);

        // 로그인 버튼 클릭 리스너
        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                // 서버 통신 없이 바로 화면 전환 (개발 모드)
                Toast.makeText(MainActivity.this, "로그인 정보 확인 생략 (개발 모드)", Toast.LENGTH_SHORT).show();

                Intent intent = new Intent(MainActivity.this, Menuactivity.class);
                startActivity(intent);

                // 로그인 화면 제거
                finish();
            }
        });

        // 회원가입 버튼 클릭 리스너
        btnSignup.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(getApplicationContext(), TermsActivity.class);
                startActivity(intent);
            }
        });

        // 🔽 여기 추가: 비밀번호 재설정 화면으로 이동
        tvFindAccount.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, ResetPasswordActivity.class);
                startActivity(intent);
            }
        });
    }
}
