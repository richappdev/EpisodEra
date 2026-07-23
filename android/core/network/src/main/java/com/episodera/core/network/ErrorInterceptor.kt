package com.episodera.core.network

import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.Response

class ErrorInterceptor(private val json: Json) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.isSuccessful) return response
        val body = response.body.string()
        response.close()
        val message = runCatching {
            json.decodeFromString<ApiErrorBody>(body).error?.message
        }.getOrNull() ?: "Request failed."
        throw ApiException(message, response.code)
    }
}
