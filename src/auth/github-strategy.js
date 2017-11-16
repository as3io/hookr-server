const GitHubStrategy = require('passport-github2').Strategy;
const InternalOAuthError = require('passport-oauth2').InternalOAuthError;

GitHubStrategy.prototype.userProfile = function(accessToken, done) {
  this._oauth2.get(this._userProfileURL, accessToken, (err, body, res) => {
    if (err) return done(new InternalOAuthError('Failed to fetch user profile', err));

    const json = JSON.parse(body);
    const profile = {
      id: String(json.id),
      displayName: json.name,
      username: json.login,
      profileUrl: json.html_url,
      email: json.email,
      photo: json.avatar_url,
      orgs: [],
    };

    if (!profile.hasOwnProperty('email')) return done(new InternalOAuthError('Failed to fetch user emails', err));

    this._oauth2.get('https://api.github.com/user/orgs', accessToken, (err, body, res) => {
      if (err) return done(new InternalOAuthError('Failed to fetch user orgs', err));

      const orgs = JSON.parse(body);
      for (var index in orgs) {
        profile.orgs.push({
          username: orgs[index].login,
          name: orgs[index].login,
          photo: orgs[index].avatar_url
        });
      }

      done(null, profile);

    })
  });
};


exports.GitHubStrategy = GitHubStrategy;
