package com.episodera.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.episodera.app.navigation.EpisodEraApp
import com.episodera.core.design.EpisodEraTheme
import dagger.hilt.android.AndroidEntryPoint
import com.episodera.core.network.PreferencesStore
import java.util.Locale
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    @Inject lateinit var preferences: PreferencesStore

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val locale = Locale.forLanguageTag(preferences.language())
        Locale.setDefault(locale)
        resources.updateConfiguration(resources.configuration.apply { setLocale(locale) }, resources.displayMetrics)
        enableEdgeToEdge()
        setContent {
            EpisodEraTheme {
                EpisodEraApp()
            }
        }
    }
}
