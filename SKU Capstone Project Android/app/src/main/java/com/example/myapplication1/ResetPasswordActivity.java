package com.example.myapplication1;

import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

import java.io.IOException;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ResetPasswordActivity extends AppCompatActivity {

    private static final String TAG = "ResetPassword_Debug";

    private ApiService apiService;

    EditText etEmail, etCode, etNewPw, etNewPwCheck;
    Button btnRequestVerify, btnCheckVerify, btnResetPassword;

    private boolean isEmailVerified = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reset_password);

        apiService = RetrofitClient.getApiService();

        etEmail = findViewById(R.id.et_email);
        etCode = findViewById(R.id.et_code);
        etNewPw = findViewById(R.id.et_new_pw);
        etNewPwCheck = findViewById(R.id.et_new_pw_check);

        btnRequestVerify = findViewById(R.id.btn_request_verify);
        btnCheckVerify = findViewById(R.id.btn_check_verify);
        btnResetPassword = findViewById(R.id.btn_reset_password);

        // 1. 비밀번호 재설정용 이메일 인증 요청
        btnRequestVerify.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            if (email.isEmpty()) {
                Toast.makeText(this, "이메일을 입력해주세요.", Toast.LENGTH_SHORT).show();
                return;
            }

            AuthModels.VerifyRequest request = new AuthModels.VerifyRequest(email);

            // ⭐ 여기 중요: requestVerify가 아니라 requestResetVerify
            apiService.requestResetVerify(request).enqueue(new Callback<AuthModels.UserResponse>() {
                @Override
                public void onResponse(Call<AuthModels.UserResponse> call, Response<AuthModels.UserResponse> response) {
                    if (response.isSuccessful() && response.body() != null && response.body().ok) {
                        Toast.makeText(ResetPasswordActivity.this,
                                "인증번호가 이메일로 발송되었습니다.", Toast.LENGTH_SHORT).show();
                        etCode.setVisibility(View.VISIBLE);
                        btnCheckVerify.setVisibility(View.VISIBLE);
                    } else {
                        handleErrorResponse(response);
                        Toast.makeText(ResetPasswordActivity.this,
                                "가입되지 않은 이메일이거나 요청 실패", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<AuthModels.UserResponse> call, Throwable t) {
                    Log.e(TAG, "인증요청 실패: " + t.getMessage());
                    Toast.makeText(ResetPasswordActivity.this,
                            "네트워크 오류", Toast.LENGTH_SHORT).show();
                }
            });
        });

        // 2. 인증번호 확인
        btnCheckVerify.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            String code = etCode.getText().toString().trim();

            if (email.isEmpty() || code.isEmpty()) {
                Toast.makeText(this, "이메일과 인증번호를 입력해주세요.", Toast.LENGTH_SHORT).show();
                return;
            }

            AuthModels.CodeCheckRequest request =
                    new AuthModels.CodeCheckRequest(email, code);

            apiService.verifyCode(request).enqueue(new Callback<AuthModels.UserResponse>() {
                @Override
                public void onResponse(Call<AuthModels.UserResponse> call, Response<AuthModels.UserResponse> response) {
                    if (response.isSuccessful() && response.body() != null && response.body().ok) {
                        isEmailVerified = true;
                        Toast.makeText(ResetPasswordActivity.this,
                                "이메일 인증 성공!", Toast.LENGTH_SHORT).show();
                        etEmail.setEnabled(false);
                        btnRequestVerify.setEnabled(false);
                    } else {
                        handleErrorResponse(response);
                        Toast.makeText(ResetPasswordActivity.this,
                                "인증번호가 틀리거나 만료되었습니다.", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<AuthModels.UserResponse> call, Throwable t) {
                    Log.e(TAG, "인증확인 실패: " + t.getMessage());
                }
            });
        });

        // 3. 비밀번호 재설정
        btnResetPassword.setOnClickListener(v -> {
            String email = etEmail.getText().toString().trim();
            String newPw = etNewPw.getText().toString().trim();
            String newPwCheck = etNewPwCheck.getText().toString().trim();

            if (!isEmailVerified) {
                Toast.makeText(this, "먼저 이메일 인증을 완료해주세요.", Toast.LENGTH_SHORT).show();
                return;
            }

            if (newPw.isEmpty() || newPwCheck.isEmpty()) {
                Toast.makeText(this, "새 비밀번호를 입력해주세요.", Toast.LENGTH_SHORT).show();
                return;
            }

            if (!newPw.equals(newPwCheck)) {
                Toast.makeText(this, "비밀번호가 서로 다릅니다.", Toast.LENGTH_SHORT).show();
                return;
            }

            AuthModels.ResetPasswordRequest request =
                    new AuthModels.ResetPasswordRequest(email, newPw);

            apiService.resetPassword(request).enqueue(new Callback<AuthModels.UserResponse>() {
                @Override
                public void onResponse(Call<AuthModels.UserResponse> call, Response<AuthModels.UserResponse> response) {
                    if (response.isSuccessful() && response.body() != null && response.body().ok) {
                        Toast.makeText(ResetPasswordActivity.this,
                                "비밀번호가 성공적으로 변경되었습니다.", Toast.LENGTH_SHORT).show();
                        finish();
                    } else {
                        handleErrorResponse(response);
                        Toast.makeText(ResetPasswordActivity.this,
                                "비밀번호 변경 실패", Toast.LENGTH_SHORT).show();
                    }
                }

                @Override
                public void onFailure(Call<AuthModels.UserResponse> call, Throwable t) {
                    Log.e(TAG, "비밀번호 변경 실패: " + t.getMessage());
                    Toast.makeText(ResetPasswordActivity.this,
                            "네트워크 오류", Toast.LENGTH_SHORT).show();
                }
            });
        });
    }

    private void handleErrorResponse(Response<?> response) {
        Log.e(TAG, "Status Code: " + response.code());
        try {
            if (response.errorBody() != null) {
                Log.e(TAG, "Error Body: " + response.errorBody().string());
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
