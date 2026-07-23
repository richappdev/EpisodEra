package com.episodera.core.network

import com.google.android.gms.tasks.Tasks
import com.google.firebase.appcheck.FirebaseAppCheck
import com.google.firebase.auth.FirebaseAuth
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Named
import javax.inject.Singleton
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import okhttp3.MediaType.Companion.toMediaType

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton fun json(): Json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    @Provides @Singleton fun firebaseAppCheck(): FirebaseAppCheck = FirebaseAppCheck.getInstance()
    @Provides @Singleton fun authTokenProvider(): AuthTokenProvider = AuthTokenProvider {
        FirebaseAuth.getInstance().currentUser?.let { user ->
            runCatching { Tasks.await(user.getIdToken(false), 5, TimeUnit.SECONDS).token }.getOrNull()
        }
    }
    @Provides @Singleton fun appCheckTokenProvider(): AppCheckTokenProvider = AppCheckTokenProvider {
        runCatching { Tasks.await(FirebaseAppCheck.getInstance().getToken(false), 5, TimeUnit.SECONDS).token }.getOrNull()
    }
    @Provides @Singleton fun languageProvider(store: PreferencesStore): LanguageProvider = LanguageProvider(store::language)
    @Provides @Singleton fun playerIdProvider(store: PreferencesStore): PlayerIdProvider = PlayerIdProvider(store::playerId)
    @Provides @Singleton fun okHttpClient(auth: AuthTokenProvider, appCheck: AppCheckTokenProvider, language: LanguageProvider, player: PlayerIdProvider, json: Json): OkHttpClient =
        OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(auth))
            .addInterceptor(AppCheckInterceptor(appCheck))
            .addInterceptor(LanguageInterceptor(language))
            .addInterceptor(PlayerIdInterceptor(player))
            .addInterceptor(ErrorInterceptor(json))
            .addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
            .build()
    @Provides @Singleton fun retrofit(client: OkHttpClient, json: Json, @Named("apiBaseUrl") baseUrl: String): Retrofit =
        Retrofit.Builder().baseUrl(baseUrl).client(client).addConverterFactory(json.asConverterFactory("application/json".toMediaType())).build()
    @Provides @Singleton fun api(retrofit: Retrofit): EpisodEraApi = retrofit.create(EpisodEraApi::class.java)
    @Provides @Singleton fun repository(api: EpisodEraApi): EpisodEraRepository = EpisodEraRepository(api)
}
