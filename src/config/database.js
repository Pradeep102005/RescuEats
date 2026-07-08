const mongoose = require('mongoose');
const connectDb = async () => {
    await mongoose.connect(
        "mongodb://pradeep:Pradeep123@ac-undmyay-shard-00-00.v3g24wv.mongodb.net:27017,ac-undmyay-shard-00-01.v3g24wv.mongodb.net:27017,ac-undmyay-shard-00-02.v3g24wv.mongodb.net:27017/surplass?ssl=true&replicaSet=atlas-cj7yka-shard-0&authSource=admin&appName=NodeX"
    );
};
module.exports = connectDb;