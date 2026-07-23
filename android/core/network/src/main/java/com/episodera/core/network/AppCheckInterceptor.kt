package com.episodera.core.network

import okhttp3.Interceptor
import okhttp3.Response

class AppCheckInterceptor(private val tokenProvider: AppCheckTokenProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokenProvider.token()
        val request = chain.request().newBuilder().apply {
            if (!token.isNullOrBlank()) header("X-Firebase-AppCheck", token)
        }.build()
        return chain.proceed(request)
    }
}
