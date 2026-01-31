"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Heart, CheckCircle } from "lucide-react";

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">Beli</span>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/api/login">Sign In</a>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24 lg:py-32">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Save and Track Your Favorite Places
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Discover new restaurants, cafes, and attractions. Save places you want to visit and track the ones you've been to - all on an interactive map.
            </p>
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/api/login">Get Started</a>
            </Button>
          </div>
        </section>

        <section className="container py-16">
          <div className="grid gap-8 md:grid-cols-3">
            <Card>
              <CardHeader>
                <MapPin className="mb-2 h-10 w-10 text-primary" />
                <CardTitle>Search Places</CardTitle>
                <CardDescription>
                  Find restaurants, cafes, attractions, and more using Google Places
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Heart className="mb-2 h-10 w-10 text-red-500" />
                <CardTitle>Want to Visit</CardTitle>
                <CardDescription>
                  Save places you want to visit and never forget about that new spot
                </CardDescription>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CheckCircle className="mb-2 h-10 w-10 text-green-500" />
                <CardTitle>Been There</CardTitle>
                <CardDescription>
                  Mark places you've visited and build your personal map of experiences
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Beli. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
