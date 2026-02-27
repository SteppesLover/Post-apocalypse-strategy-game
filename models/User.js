const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')


const UserSchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, 'Please provide a name'],
        minlength: 3,
        maxlength: 50,
    },
    email:{
        type: String,
        required: [true, 'Please provide an email'],
        match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'Please provide a valid email'
        ],
        unique: true,
    },
    password:{
        type: String,
        required: [true, 'Please provide password'],
        minlength: 8,
    },
})

UserSchema.pre('save', function(next){
    if (!this.isModified("password")) return next()
    bcrypt.genSalt(10)
      .then((salt) => bcrypt.hash(this.password, salt))
      .then((hash) => {
        this.password = hash
        next()
      })
      .catch(next)
})

UserSchema.methods.getName = function () {
    return this.name
}

UserSchema.methods.createJWT = function () {
  const lifetimeRaw = String(process.env.JWT_LIFETIME || "").trim()
  const safeLifetime = /^\d+$/.test(lifetimeRaw) || /^\d+\s*[smhdwy]$/i.test(lifetimeRaw)
    ? lifetimeRaw.replace(/\s+/g, "")
    : "7d"
  return jwt.sign(
    { userId: this._id, name: this.name },
    process.env.JWT_SECRET,
    { expiresIn: safeLifetime }
  )
}

UserSchema.methods.comparePassword = async function(candidatePassword){
  const isMatch = await bcrypt.compare(candidatePassword, this.password)
  return isMatch
}

module.exports = mongoose.model('User', UserSchema)
