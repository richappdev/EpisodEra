package com.episodera.core.network

class ApiException(message: String, val statusCode: Int? = null) : RuntimeException(message)
