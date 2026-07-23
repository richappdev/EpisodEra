package com.episodera.core.network

import java.io.IOException

class ApiException(message: String, val statusCode: Int? = null) : IOException(message)
