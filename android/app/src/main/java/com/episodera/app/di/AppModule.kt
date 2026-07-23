package com.episodera.app.di

import com.episodera.app.BuildConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Named

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    @Named("apiBaseUrl")
    fun apiBaseUrl(): String {
        val raw = BuildConfig.API_BASE_URL.trimEnd('/')
        return "$raw/"
    }
}
