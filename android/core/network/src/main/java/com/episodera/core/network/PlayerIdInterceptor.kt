package com.episodera.core.network

import okhttp3.Interceptor
import okhttp3.Response

class PlayerIdInterceptor(private val playerIdProvider: PlayerIdProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val playerId = playerIdProvider.playerId()
        val request = chain.request().newBuilder().apply {
            if (!playerId.isNullOrBlank()) header("X-Episodera-Player-Id", playerId)
        }.build()
        return chain.proceed(request)
    }
}
