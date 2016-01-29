var Bourne, Suggestions, _, async;

_ = require('underscore');

async = require('async');

Bourne = require('bourne');

module.exports = Suggestions = (function() {
  function Suggestions(engine) {
    this.engine = engine;
    this.db = new Bourne('./db-suggestions.json', true);
  }

  Suggestions.prototype.forUser = function(user, done) {
    return this.db.findOne({
      user: user
    }, function(err, arg) {
      var suggestions;
      suggestions = (arg != null ? arg : {
        suggestion: []
      }).suggestions;
      if (err != null) {
        return done(err);
      }
      return done(null, suggestions);
    });
  };

  Suggestions.prototype.update = function(user, done) {
    return this.engine.similars.byUser(user, (function(_this) {
      return function(err, others) {
        if (err != null) {
          return done(err);
        }
        return async.auto({
          likes: function(done) {
            return _this.engine.likes.itemsByUser(user, done);
          },
          dislikes: function(done) {
            return _this.engine.dislikes.itemsByUser(user, done);
          },
          items: function(done) {
            return async.map(others, function(other, done) {
              return async.map([_this.engine.likes, _this.engine.dislikes], function(rater, done) {
                return rater.itemsByUser(other.user, done);
              }, done);
            }, done);
          }
        }, function(err, arg) {
          var dislikes, items, likes;
          likes = arg.likes, dislikes = arg.dislikes, items = arg.items;
          if (err != null) {
            return done(err);
          }
          items = _.difference(_.unique(_.flatten(items)), likes, dislikes);
          return _this.db["delete"]({
            user: user
          }, function(err) {
            if (err != null) {
              return done(err);
            }
            return async.map(items, function(item, done) {
              return async.auto({
                likers: function(done) {
                  return _this.engine.likes.usersByItem(item, done);
                },
                dislikers: function(done) {
                  return _this.engine.dislikes.usersByItem(item, done);
                }
              }, function(err, arg1) {
                var dislikers, i, len, likers, numerator, other, ref;
                likers = arg1.likers, dislikers = arg1.dislikers;
                if (err != null) {
                  return done(err);
                }
                numerator = 0;
                ref = _.without(_.flatten([likers, dislikers]), user);
                for (i = 0, len = ref.length; i < len; i++) {
                  other = ref[i];
                  other = _.findWhere(others, {
                    user: other
                  });
                  if (other != null) {
                    numerator += other.similarity;
                  }
                }
                return done(null, {
                  item: item,
                  weight: numerator / _.union(likers, dislikers).length
                });
              });
            }, function(err, suggestions) {
              if (err != null) {
                return done(err);
              }
              return _this.db.insert({
                user: user,
                suggestions: suggestions
              }, done);
            });
          });
        });
      };
    })(this));
  };

  return Suggestions;

})();