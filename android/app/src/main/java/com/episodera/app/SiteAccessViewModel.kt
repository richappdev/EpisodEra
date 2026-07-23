package com.episodera.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.remoteconfig.FirebaseRemoteConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

@HiltViewModel
class SiteAccessViewModel @Inject constructor() : ViewModel() {
    private val _blocked = MutableStateFlow(false)
    val blocked = _blocked.asStateFlow()

    init {
        viewModelScope.launch {
            runCatching {
                val config = FirebaseRemoteConfig.getInstance()
                config.fetchAndActivate().await()
                _blocked.value = config.getBoolean("site_access_blocked")
            }
        }
    }
}
