<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
    <#elseif section = "form">

    <div class="ab-page">

        <!-- LEFT: Login card -->
        <div class="ab-left">
            <div class="ab-card">

                <!-- Header -->
                <div class="ab-header">
                    <div class="ab-logo-circle">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#10b981" width="30" height="30">
                            <path d="M1 8a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v1h2.382a1 1 0 0 1 .894.553l1.618 3.235A1 1 0 0 1 21 13v3a1 1 0 0 1-1 1h-1.07A2 2 0 0 1 15 17a2 2 0 0 1-3.93-.5H9.93A2 2 0 0 1 6 17a2 2 0 0 1-3.93-.5H2a1 1 0 0 1-1-1V8zm14 7.268A2.001 2.001 0 0 1 17 17a2 2 0 0 1 1.732-1H19v-2h-4v3.268zM15 13V9H3v6h.268A2.001 2.001 0 0 1 6 13.268 2.001 2.001 0 0 1 8.732 15H13V9h2v4h-2v.268A2 2 0 0 1 15 13zm-9 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                        </svg>
                    </div>
                    <h1 class="ab-brand">AmarBazaar</h1>
                    <h2 class="ab-title">Admin Portal</h2>
                    <p class="ab-sub">Sign in to manage your deliveries</p>
                </div>

                <!-- Error -->
                <#if messagesPerField.existsError('username','password')>
                    <div class="ab-error">
                        ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                    </div>
                </#if>

                <!-- Form -->
                <form id="kc-form-login" action="${url.loginAction}" method="post">

                    <div class="ab-field">
                        <label for="username" class="ab-label">
                            <#if !realm.loginWithEmailAllowed>Username
                            <#elseif !realm.registrationEmailAsUsername>Username or Email
                            <#else>Email</#if>
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            class="ab-input"
                            placeholder="admin@amarbazaar.com"
                            value="${login.username!''}"
                            autofocus
                            autocomplete="username"
                        />
                    </div>

                    <div class="ab-field">
                        <label for="password" class="ab-label">Password</label>
                        <div class="ab-input-wrap">
                            <input
                                id="password"
                                name="password"
                                type="password"
                                class="ab-input"
                                placeholder="Enter your password"
                                autocomplete="current-password"
                            />
                            <button type="button" class="ab-eye" onclick="togglePwd()" aria-label="Toggle password">
                                <svg id="eye-svg" xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div class="ab-options">
                        <#if realm.rememberMe && !usernameEditDisabled??>
                            <label class="ab-remember">
                                <input type="checkbox" name="rememberMe" class="ab-check" <#if login.rememberMe??>checked</#if> />
                                <span>Keep me logged in</span>
                            </label>
                        <#else>
                            <span></span>
                        </#if>
                        <#if realm.resetPasswordAllowed>
                            <a href="${url.loginResetCredentialsUrl}" class="ab-forgot">Forgot Password?</a>
                        </#if>
                    </div>

                    <input type="hidden" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>

                    <button type="submit" id="kc-login" class="ab-btn">
                        Login to Dashboard &nbsp;→
                    </button>

                </form>

                <div class="ab-bar"></div>
            </div>
        </div>

        <!-- RIGHT: Branding panel -->
        <div class="ab-right">
            <div class="ab-right-inner">
                <div class="ab-right-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="rgba(255,255,255,0.95)" width="52" height="52">
                        <path d="M1 8a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v1h2.382a1 1 0 0 1 .894.553l1.618 3.235A1 1 0 0 1 21 13v3a1 1 0 0 1-1 1h-1.07A2 2 0 0 1 15 17a2 2 0 0 1-3.93-.5H9.93A2 2 0 0 1 6 17a2 2 0 0 1-3.93-.5H2a1 1 0 0 1-1-1V8zm14 7.268A2.001 2.001 0 0 1 17 17a2 2 0 0 1 1.732-1H19v-2h-4v3.268zM15 13V9H3v6h.268A2.001 2.001 0 0 1 6 13.268 2.001 2.001 0 0 1 8.732 15H13V9h2v4h-2v.268A2 2 0 0 1 15 13zm-9 2a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm11 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/>
                    </svg>
                </div>
                <h2 class="ab-right-title">AmarBazaar</h2>
                <p class="ab-right-subtitle">Admin Portal</p>
                <p class="ab-right-desc">Manage your deliveries, products, orders and more — all from one place.</p>
                <ul class="ab-right-list">
                    <li>Real-time order tracking</li>
                    <li>Product &amp; inventory management</li>
                    <li>Delivery analytics dashboard</li>
                    <li>Banner &amp; category control</li>
                </ul>
            </div>
        </div>

    </div>

    <script>
        function togglePwd() {
            var p = document.getElementById('password');
            var s = document.getElementById('eye-svg');
            if (p.type === 'password') {
                p.type = 'text';
                s.setAttribute('stroke', '#10b981');
            } else {
                p.type = 'password';
                s.setAttribute('stroke', '#6b7280');
            }
        }
    </script>

    </#if>
</@layout.registrationLayout>
