package com.example.myapplication1;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity_Login";
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
        TextView tvFindAccount = findViewById(R.id.tv_find_account);

        // 1. API 설정 (서버가 3001번 포트에서 대기 중인 설정 반영)
        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl("http://10.0.2.2:3001/")
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        apiService = retrofit.create(ApiService.class);

        // 로그인 버튼 클릭 리스너
        btnLogin.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                performLogin();
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

        // 비밀번호 재설정 화면으로 이동
        tvFindAccount.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                Intent intent = new Intent(MainActivity.this, ResetPasswordActivity.class);
                startActivity(intent);
            }
        });
    }

    private void performLogin() {
        String email = etId.getText().toString().trim();
        String password = etPassword.getText().toString().trim();

        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(MainActivity.this, "아이디(이메일)와 비밀번호를 입력해주세요.", Toast.LENGTH_SHORT).show();
            return;
        }

        // 2. 서버에 보낼 로그인 요청 객체 생성
        AuthModels.LoginRequest loginRequest = new AuthModels.LoginRequest(email, password);

        // 3. API 호출
        apiService.login(loginRequest).enqueue(new Callback<AuthModels.UserResponse>() {
            @Override
            public void onResponse(Call<AuthModels.UserResponse> call, Response<AuthModels.UserResponse> response) {
                if (response.isSuccessful() && response.body() != null && response.body().ok) {
                    // 로그인 성공 시 로직
                    saveUserSession(email); // 세션 데이터 저장

                    Toast.makeText(MainActivity.this, "로그인에 성공했습니다.", Toast.LENGTH_SHORT).show();

                    Intent intent = new Intent(MainActivity.this, Menuactivity.class);
                    startActivity(intent);
                    finish();
                } else {
                    // 로그인 실패 (ID/PW 불일치 등)
                    Toast.makeText(MainActivity.this, "로그인 정보가 올바르지 않습니다.", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<AuthModels.UserResponse> call, Throwable t) {
                // 네트워크 오류 (서버 꺼짐 등)
                Log.e(TAG, "Login Network Error: " + t.getMessage());
                Toast.makeText(MainActivity.this, "서버 연결에 실패했습니다. 네트워크를 확인하세요.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    // 💡 로그인 성공 시 사용자 이메일을 기기에 저장하는 함수
    private void saveUserSession(String email) {
        SharedPreferences pref = getSharedPreferences("user_info", MODE_PRIVATE);
        SharedPreferences.Editor editor = pref.edit();
        editor.putString("user_email", email);
        editor.apply();
    }
}