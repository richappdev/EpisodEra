package com.episodera.core.network

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiExceptionTest {
    @Test
    fun apiExceptionIsReportedAsNetworkFailure() {
        val exception = ApiException("Authentication is required.", 401)

        assertTrue(java.io.IOException::class.java.isAssignableFrom(ApiException::class.java))
        assertEquals("Authentication is required.", exception.message)
        assertEquals(401, exception.statusCode)
    }
}
