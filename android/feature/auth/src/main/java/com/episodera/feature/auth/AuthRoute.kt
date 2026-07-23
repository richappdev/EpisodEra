package com.episodera.feature.auth

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.hilt.navigation.compose.hiltViewModel
import com.episodera.core.model.UpdateUserProfileInput
import com.episodera.core.network.EpisodEraRepository
import com.google.firebase.auth.FirebaseAuth
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.launch

data class AuthUiState(val loading: Boolean = false, val error: String? = null, val signedIn: Boolean = false)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val auth: FirebaseAuth,
    private val repository: EpisodEraRepository,
) : ViewModel() {
    var state by mutableStateOf(AuthUiState()); private set

    fun signIn(email: String, password: String) = authenticate {
        auth.signInWithEmailAndPassword(email, password)
    }

    fun signUp(email: String, password: String, firstName: String, lastName: String) {
        state = state.copy(loading = true, error = null)
        auth.createUserWithEmailAndPassword(email, password).addOnCompleteListener { result ->
            if (!result.isSuccessful) {
                state = state.copy(loading = false, error = result.exception?.message ?: "Unable to create account")
            } else {
                // The profile endpoint is deliberately called after Firebase has produced an ID token.
                viewModelScope.launch {
                    runCatching {
                        repository.updateProfile(UpdateUserProfileInput(firstName = firstName, lastName = lastName))
                    }.onFailure { error ->
                        state = state.copy(error = error.message ?: "Account created, but profile setup failed")
                    }
                    state = state.copy(loading = false, signedIn = true)
                }
            }
        }
    }

    private fun authenticate(action: () -> com.google.android.gms.tasks.Task<*>) {
        state = state.copy(loading = true, error = null)
        action().addOnCompleteListener { result ->
            state = if (result.isSuccessful) AuthUiState(signedIn = true)
            else AuthUiState(error = result.exception?.message ?: "Sign in failed")
        }
    }
}

@Composable
fun AuthRoute(onAuthenticated: () -> Unit, viewModel: AuthViewModel = hiltViewModel()) {
    val state = viewModel.state
    LaunchedEffect(state.signedIn) { if (state.signedIn) onAuthenticated() }
    AuthScreen(state, viewModel::signIn, viewModel::signUp)
}

@Composable
fun AuthScreen(
    state: AuthUiState,
    onSignIn: (String, String) -> Unit,
    onSignUp: (String, String, String, String) -> Unit,
) {
    var signUp by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
        Divider(color = Color(0xff00d9e8), thickness = 4.dp)
        Spacer(Modifier.height(20.dp))
        Text("Episodera", style = MaterialTheme.typography.displayMedium)
        Text("Cinema Memory", color = MaterialTheme.colorScheme.secondary)
        Spacer(Modifier.height(28.dp))
        if (signUp) {
            OutlinedTextField(firstName, { firstName = it }, label = { Text("First name") }, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(lastName, { lastName = it }, label = { Text("Last name") }, modifier = Modifier.fillMaxWidth())
        }
        OutlinedTextField(email, { email = it }, label = { Text("Email") }, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(password, { password = it }, label = { Text("Password") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        Spacer(Modifier.height(16.dp))
        Button(
            enabled = !state.loading && email.isNotBlank() && password.isNotBlank(),
            onClick = { if (signUp) onSignUp(email, password, firstName, lastName) else onSignIn(email, password) },
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (state.loading) "Please wait…" else if (signUp) "Create your account" else "Enter Episodera") }
        TextButton(onClick = { signUp = !signUp }, modifier = Modifier.fillMaxWidth()) {
            Text(if (signUp) "Already have an account? Sign in" else "New here? Create an account")
        }
    }
}
