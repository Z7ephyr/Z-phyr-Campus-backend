import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://192.168.1')) {
        callback(null, true);
      } else {
        callback(null, true); 
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Origin,X-Requested-With,Content-Type,Accept,Authorization,X-HTTP-Method-Override',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, 
      transform: true, 
    }),
  );

 
  const port = process.env.PORT || 3000; 
  
  await app.listen(port);
  console.log(`🚀 Zéphyr Campus API running on: http://localhost:${port}`);
}
bootstrap();