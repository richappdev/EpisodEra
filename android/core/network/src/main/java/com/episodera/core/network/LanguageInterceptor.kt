package com.episodera.core.network

import okhttp3.Interceptor
import okhttp3.Response

class LanguageInterceptor(private val languageProvider: LanguageProvider) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val language = languageProvider.language()
        val request = chain.request().newBuilder().apply {
            if (!language.isNullOrBlank() && chain.request().url.queryParameter("language") == null) {
                url(chain.request().url.newBuilder().addQueryParameter("language", language).build())
            }
        }.build()
        return chain.proceed(request)
    }
}
