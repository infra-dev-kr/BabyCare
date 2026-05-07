package com.example.myapplication1;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.Header;
import retrofit2.http.POST;
import retrofit2.http.PUT;
import retrofit2.http.Path;

public interface ApiService {

    // === 1. 인증 및 회원 관련 (Auth) ===

    @POST("auth/request-verify")
    Call<AuthModels.UserResponse> requestVerify(@Body AuthModels.VerifyRequest body);

    @POST("auth/request-reset-verify")
    Call<AuthModels.UserResponse> requestResetVerify(@Body AuthModels.VerifyRequest body);

    @POST("auth/verify-code")
    Call<AuthModels.UserResponse> verifyCode(@Body AuthModels.CodeCheckRequest body);

    @POST("auth/signup")
    Call<AuthModels.UserResponse> signup(@Body AuthModels.SignupRequest body);

    @POST("auth/login")
    Call<AuthModels.UserResponse> login(@Body AuthModels.LoginRequest body);

    @POST("auth/refresh")
    Call<AuthModels.UserResponse> refresh(@Body Map<String, String> refreshToken);

    @POST("auth/reset-password")
    Call<AuthModels.UserResponse> resetPassword(@Body AuthModels.ResetPasswordRequest body);

    @PUT("auth/update-profile")
    Call<AuthModels.UserResponse> updateProfile(@Body AuthModels.UpdateProfileRequest body);


    // === 2. 데이터 및 스케줄 관련 (Data) ===

    @GET("api/policies")
    Call<List<AuthModels.PolicyResponse>> getPolicies();

    @GET("api/vaccine/schedule/{userId}")
    Call<List<AuthModels.VaccineResponse>> getVaccineSchedule(
            @Path("userId") String userId
    );

    @PUT("api/vaccine/update/{vaccineId}")
    Call<Void> updateVaccine(
            @Path("vaccineId") String vaccineId,
            @Body AuthModels.VaccineUpdate request
    );


    // === 3. 센서 / 수면 데이터 ===

    @GET("api/sensor/latest/{userId}")
    Call<AuthModels.TemperHumilityResponse> getLatestTemper(
            @Path("userId") String userId
    );

    @GET("api/sensor/history/{userId}")
    Call<List<AuthModels.TemperHistoryResponse>> getTemperHistory(
            @Path("userId") String userId
    );

    @GET("api/sleep/data")
    Call<List<AuthModels.SleepResponse>> getSleepData();


    // === 4. SmartThings (IoT) ===

    // PAT 등록
    @POST("api/smartthings/register")
    Call<AuthModels.DeviceResponse> registerSTToken(
            @Header("Authorization") String jwtToken,
            @Body AuthModels.STTokenRequest body
    );

    // ✅ 디바이스 목록 조회 (List → DeviceResponse 단일로 수정)
    @GET("api/smartthings/devices")
    Call<AuthModels.DeviceResponse> getDevices(
            @Header("Authorization") String jwtToken
    );

    // ✅ 디바이스 상태 조회
    @GET("api/smartthings/status/{deviceId}")
    Call<AuthModels.DeviceStatusResponse> getDeviceStatus(
            @Header("Authorization") String jwtToken,
            @Path("deviceId") String deviceId
    );

    // ✅ 디바이스 제어
    @POST("api/smartthings/control")
    Call<AuthModels.ControlResponse> controlDevice(
            @Header("Authorization") String jwtToken,
            @Body AuthModels.ControlRequest body
    );


    // === 5. AI 보고서 ===

    @GET("api/ai/report/latest")
    Call<AuthModels.AiReportResponse> getLatestReport();

    @POST("api/ai/generate")
    Call<AuthModels.AiReportResponse> generateReport();
}